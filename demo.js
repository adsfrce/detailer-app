// DetailHQ Demo Mode (Supabase same project)
// - Uses real Supabase client + maps tables to demo_*
// - Fakes auth session (no "random account" sticking)
// - Blocks writes (POST/PUT/PATCH/DELETE) to Supabase

(function () {
  "use strict";

  // Only run on demo page
  const isDemo = !!(window.__DETAILHQ_DEMO || window.DETAILHQ_DEMO || String(location.pathname).includes("demo"));
  if (!isDemo) return;

  const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
  const DEMO_EMAIL = "demo@detailhq.de";

  const TABLE_MAP = {
    profiles: "demo_profiles",
    services: "demo_services",
    vehicle_classes: "demo_vehicle_classes",
    bookings: "demo_bookings",
  };

  // 1) Kill any persisted real Supabase sessions (prevents "random user" auto-login)
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

  // 2) Block writes to Supabase (keeps demo read-only even if RLS would allow)
  const realFetch = window.fetch.bind(window);
  const SUPABASE_HOST_RE = /\.supabase\.co\b/i;

  window.fetch = async function (input, init) {
    const url = (typeof input === "string") ? input : (input && input.url ? input.url : "");
    const method = (init && init.method ? String(init.method).toUpperCase() : "GET");

    if (SUPABASE_HOST_RE.test(url) && method !== "GET") {
      // Pretend OK (prevents UI errors)
      return new Response(JSON.stringify({ ok: true, demo: true, blocked: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  };

  // 3) Patch supabase.createClient so app stays unchanged
  //    - Use real client
  //    - Map .from("services") -> .from("demo_services") etc.
  //    - Fake auth session methods so app thinks it's logged in as DEMO_USER_ID
  function patchSupabaseCreateClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") return false;
    if (window.supabase.__detailhqDemoPatched) return true;

    const originalCreateClient = window.supabase.createClient.bind(window.supabase);

    window.supabase.createClient = function (...args) {
      const client = originalCreateClient(...args);

      // map table names
      const realFrom = client.from.bind(client);
      client.from = function (table) {
        const mapped = TABLE_MAP[table] || table;
        return realFrom(mapped);
      };

      // fake auth (only for demo UI; data comes from demo_* tables via anon key + RLS select)
      const demoSession = {
        access_token: "demo-access-token",
        refresh_token: "demo-refresh-token",
        token_type: "bearer",
        user: { id: DEMO_USER_ID, email: DEMO_EMAIL },
      };

      const realAuth = client.auth;
      client.auth = Object.assign({}, realAuth, {
        getSession: async () => ({ data: { session: demoSession }, error: null }),
        getUser: async () => ({ data: { user: demoSession.user }, error: null }),
        onAuthStateChange: (cb) => {
          try { cb("SIGNED_IN", demoSession); } catch (_) {}
          return { data: { subscription: { unsubscribe() {} } } };
        },
        signOut: async () => ({ error: null }),
      });

      return client;
    };

    window.supabase.__detailhqDemoPatched = true;
    return true;
  }

  // Run patch ASAP + retry a few times (in case CDN supabase script loads slightly later)
  if (!patchSupabaseCreateClient()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (patchSupabaseCreateClient() || tries > 80) clearInterval(t);
    }, 25);
  }

  // 4) Small demo marker
  window.addEventListener("DOMContentLoaded", () => {
    try {
      const tag = document.createElement("div");
      tag.textContent = "DEMO – Daten aus demo_* Tabellen (read-only)";
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
