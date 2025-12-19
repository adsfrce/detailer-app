// DetailHQ Demo Mode (same repo / same project)
// Goals:
// - Load real app.html + app.js (always up-to-date)
// - Force demo auth user
// - Route reads to demo_* tables via .from() mapping
// - Block ALL writes (Supabase REST + api.detailhq.de) without UI crashes

(function () {
  "use strict";
// Intercept window.supabase assignment to patch createClient BEFORE app.js runs
(function interceptSupabase() {
  const desc = Object.getOwnPropertyDescriptor(window, "supabase");
  if (desc && desc.set) return; // already intercepted

  let _sb;
  Object.defineProperty(window, "supabase", {
    configurable: true,
    get() { return _sb; },
    set(v) {
      _sb = v;
      try { patchSupabaseCreateClient(); } catch (_) {}
    }
  });
})();

  const isDemo =
    !!(window.__DETAILHQ_DEMO || window.DETAILHQ_DEMO) ||
    String(location.pathname).toLowerCase().includes("demo");
  if (!isDemo) return;

  const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
  const DEMO_EMAIL = "demo@detailhq.de";

  const TABLE_MAP = {
    profiles: "demo_profiles",
    services: "demo_services",
    vehicle_classes: "demo_vehicle_classes",
    bookings: "demo_bookings",
  };

  // 1) Purge any persisted real sessions (prevents random user bleed)
  try {
    const purge = (store) => {
      const keys = [];
      for (let i = 0; i < store.length; i++) keys.push(store.key(i));
      for (const k of keys) {
        if (!k) continue;
        const lk = k.toLowerCase();
        if (k.startsWith("sb-") || lk.includes("supabase") || lk.includes("auth-token")) {
          store.removeItem(k);
        }
      }
    };
    purge(localStorage);
    purge(sessionStorage);
  } catch (_) {}

  // 2) Block writes (Supabase + your API). Keep reads untouched.
  const realFetch = window.fetch.bind(window);
  const SUPABASE_HOST_RE = /\.supabase\.co\b/i;
  const API_HOST_RE = /^https:\/\/api\.detailhq\.de\b/i;

  function okJson(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  window.fetch = async function (input, init) {
    const url =
      typeof input === "string" ? input : (input && input.url ? input.url : "");
    const method = init && init.method ? String(init.method).toUpperCase() : "GET";

    // Block ALL non-GET to Supabase
    if (SUPABASE_HOST_RE.test(url) && method !== "GET") {
      // Supabase expects JSON; app only checks "error", not returned "data"
      return okJson({ ok: true, demo: true, blocked: true });
    }

    // Block write-ish calls to your API (confirm/propose/support etc.)
    if (API_HOST_RE.test(url) && method !== "GET") {
      return okJson({ ok: true, demo: true, blocked: true });
    }

    return realFetch(input, init);
  };

  // 3) Patch supabase.createClient:
  // - map tables
  // - fake auth to DEMO user
function patchSupabaseCreateClient() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") return false;
  if (window.supabase.__detailhqDemoPatched) return true;

  const originalCreateClient = window.supabase.createClient.bind(window.supabase);

  window.supabase.createClient = function (url, key, opts = {}) {
    // Force NO session persistence (but do NOT break storage globally)
opts.auth = Object.assign({}, opts.auth || {}, {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
  storage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  }
});

    const client = originalCreateClient(url, key, opts);

    // map table names
    const realFrom = client.from.bind(client);
    client.from = function (table) {
      const mapped = TABLE_MAP[table] || table;
      return realFrom(mapped);
    };

    // fake auth session
const demoSession = {
  access_token: key,
  refresh_token: key,
  token_type: "bearer",
  user: { id: DEMO_USER_ID, email: DEMO_EMAIL }
};

    const realAuth = client.auth;
    client.auth = Object.assign({}, realAuth, {
      getSession: async () => ({ data: { session: demoSession }, error: null }),
      getUser: async () => ({ data: { user: demoSession.user }, error: null }),
      onAuthStateChange: (cb) => {
        try { cb("SIGNED_IN", demoSession); } catch (_) {}
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async () => ({ error: null })
    });

    return client;
  };

  window.supabase.__detailhqDemoPatched = true;
  return true;
}

  // Patch ASAP (supabase UMD loads from CDN)
  if (!patchSupabaseCreateClient()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (patchSupabaseCreateClient() || tries > 120) clearInterval(t);
    }, 25);
  }

  // Small badge
  window.addEventListener("DOMContentLoaded", () => {
    try {
      const tag = document.createElement("div");
      tag.textContent = "DEMO – read-only (demo_* Tabellen)";
      tag.style.position = "fixed";
      tag.style.left = "12px";
      tag.style.bottom = "12px";
      tag.style.zIndex = "99999";
      tag.style.fontSize = "12px";
      tag.style.padding = "8px 10px";
      tag.style.borderRadius = "12px";
      tag.style.background = "rgba(255,255,255,0.75)";
      tag.style.border = "1px solid rgba(0,0,0,0.08)";
      tag.style.backdropFilter = "blur(10px)";
      tag.style.color = "rgba(0,0,0,0.8)";
      document.body.appendChild(tag);
    } catch (_) {}
  });
})();
