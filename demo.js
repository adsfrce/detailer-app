// DetailHQ Demo Overlay
// - No login required (fake session)
// - No real saving (writes are blocked or kept in-memory until reload)
// - Read endpoints return deterministic demo data relative to 'today'

(function () {
  "use strict";

  // -----------------------------
  // Config
  // -----------------------------
  const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
  const DEMO_EMAIL = "demo@detailhq.de";
  const DEMO_COMPANY = "Demo Detailing Studio";
  const DEMO_TIMEZONE = "Europe/Berlin";

  // Detect Supabase / API domains (used to block accidental writes)
  const SUPABASE_HOST_RE = /\.supabase\.co\b/i;
  const API_HOST_RE = /api\.detailhq\.de\b/i;

  // -----------------------------
  // Utilities
  // -----------------------------
  function tzDate(d) {
    // Keep native Date; your UI formatting already uses local time.
    return new Date(d);
  }

  function iso(d) {
    return tzDate(d).toISOString();
  }

  function addMinutes(d, mins) {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() + mins);
    return x;
  }

  function setTime(base, hh, mm) {
    const x = new Date(base);
    x.setHours(hh, mm, 0, 0);
    return x;
  }

  function addDays(base, days) {
    const x = new Date(base);
    x.setDate(x.getDate() + days);
    return x;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // -----------------------------
  // Demo data (in-memory until reload)
  // -----------------------------
  const today = new Date();
  today.setSeconds(0, 0);

  function generateBookings() {
    const base = new Date();
    base.setSeconds(0, 0);

    const statuses = ["geplant", "in_arbeit", "fertig", "storniert", "no_show"];
    const pay = ["bezahlt", "offen", "teilzahlung"];

    const cars = [
      "BMW 3er • Schwarz",
      "Audi A4 • Grau",
      "VW Golf • Weiß",
      "Porsche 911 • Blau",
      "Tesla Model 3 • Rot",
      "Mercedes C-Klasse • Silber",
      "BMW X5 • Schwarz",
      "Audi Q5 • Weiß"
    ];

    const customers = [
      { name: "Max Mustermann", email: "max@example.com", phone: "+49 151 1234567" },
      { name: "Lisa Wagner", email: "lisa@example.com", phone: "+49 160 9876543" },
      { name: "Ali Yilmaz", email: "ali@example.com", phone: "+49 171 5551234" },
      { name: "Sophie Becker", email: "sophie@example.com", phone: "+49 152 4443322" },
      { name: "Jonas Klein", email: "jonas@example.com", phone: "+49 176 7788990" },
    ];

    // 15 bookings across 0..6 days, 08:00..18:00
    const times = [
      [8, 0], [9, 30], [11, 0], [12, 30], [14, 0], [15, 30], [17, 0], [18, 0]
    ];

    const out = [];
    let idCounter = 1;

    for (let i = 0; i < 15; i++) {
      const dayOffset = i % 7;
      const t = times[i % times.length];
      const start = setTime(addDays(base, dayOffset), t[0], t[1]);
      const end = addMinutes(start, 90);

      const c = customers[i % customers.length];
      const car = cars[i % cars.length];

      const status = statuses[i % statuses.length];
      const payment_status = pay[(i + 1) % pay.length];

      out.push({
        id: `demo-booking-${idCounter++}`,
        detailer_id: DEMO_USER_ID,
        customer_name: c.name,
        customer_email: c.email,
        customer_phone: c.phone,
        customer_address: "Karlsruhe, DE",
        car,
        notes: i % 3 === 0 ? "Kundenwunsch: extra Fokus Felgen & Innenraum." : "",
        start_at: iso(start),
        end_at: iso(end),
        status,
        payment_status,
        total_price: 149 + (i % 5) * 50,
        vehicle_class_id: i % 2 === 0 ? "vc-1" : "vc-2",
        service_id: i % 3 === 0 ? "svc-ppf" : (i % 3 === 1 ? "svc-keramik" : "svc-detailing")
      });
    }

    return out;
  }

  const DEMO_DB = {
    profiles: [
      {
        id: DEMO_USER_ID,
        company_name: DEMO_COMPANY,
        calendar_url: "https://calendar.google.com/calendar/u/0/r",
        review_url: "https://g.page/r/demo-review",
        booking_slug: "DEMO",
        opening_hours: {
          mon: { open: true, start: "08:00", end: "18:00" },
          tue: { open: true, start: "08:00", end: "18:00" },
          wed: { open: true, start: "08:00", end: "18:00" },
          thu: { open: true, start: "08:00", end: "18:00" },
          fri: { open: true, start: "08:00", end: "18:00" },
          sat: { open: true, start: "09:00", end: "14:00" },
          sun: { open: false, start: "", end: "" }
        },
        public_daily_limit: 4
      }
    ],
    vehicle_classes: [
      { id: "vc-1", detailer_id: DEMO_USER_ID, name: "PKW" },
      { id: "vc-2", detailer_id: DEMO_USER_ID, name: "SUV / VAN" }
    ],
    services: [
      { id: "svc-detailing", detailer_id: DEMO_USER_ID, name: "Detailing Paket", price: 199, type: "package", description: "Außen + Innen, quick turnaround." },
      { id: "svc-keramik", detailer_id: DEMO_USER_ID, name: "Keramikversiegelung", price: 599, type: "package", description: "High gloss, easy maintenance." },
      { id: "svc-ppf", detailer_id: DEMO_USER_ID, name: "PPF Frontpaket", price: 899, type: "package", description: "Frontschutz gegen Steinschläge." },
      { id: "svc-ozon", detailer_id: DEMO_USER_ID, name: "Ozonbehandlung", price: 79, type: "single", description: "Geruchsentfernung." },
      { id: "svc-felgen", detailer_id: DEMO_USER_ID, name: "Felgenreinigung", price: 49, type: "single", description: "Intensivreinigung inkl. Versiegelung." }
    ],
    bookings: generateBookings(),
    signup_events: []
  };

  // -----------------------------
  // Fake auth/session (always signed in)
  // -----------------------------
  const demoSession = {
    access_token: "demo-access-token",
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    user: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL
    }
  };

  // -----------------------------
  // Supabase client mock
  // -----------------------------
  function filterRows(rows, filters) {
    let out = rows.slice();

    for (const f of filters) {
      const { op, col, val } = f;
      if (op === "eq") out = out.filter(r => String(r[col]) === String(val));
      if (op === "gte") out = out.filter(r => (r[col] || "") >= val);
      if (op === "lt") out = out.filter(r => (r[col] || "") < val);
    }
    return out;
  }

  class Query {
    constructor(table) {
      this.table = table;
      this._filters = [];
      this._order = null;
      this._single = false;
      this._selectCols = "*";
      this._op = "select";
      this._payload = null;
    }

    select(cols = "*") { this._op = "select"; this._selectCols = cols; return this; }
    insert(payload) { this._op = "insert"; this._payload = payload; return this; }
    update(payload) { this._op = "update"; this._payload = payload; return this; }
    delete() { this._op = "delete"; return this; }

    eq(col, val) { this._filters.push({ op: "eq", col, val }); return this; }
    gte(col, val) { this._filters.push({ op: "gte", col, val }); return this; }
    lt(col, val) { this._filters.push({ op: "lt", col, val }); return this; }

    order(col, opts) { this._order = { col, asc: !!(opts && opts.ascending) }; return this; }
    single() { this._single = true; return this; }

    async _exec() {
      const table = this.table;
      const rows = DEMO_DB[table] ? DEMO_DB[table] : [];

      if (this._op === "select") {
        let out = filterRows(rows, this._filters);
        if (this._order) {
          const { col, asc } = this._order;
          out.sort((a, b) => {
            const av = a[col];
            const bv = b[col];
            if (av === bv) return 0;
            return (av > bv ? 1 : -1) * (asc ? 1 : -1);
          });
        }
        const data = this._single ? (out[0] || null) : out;
        return { data: deepClone(data), error: null };
      }

      if (this._op === "insert") {
        const payload = Array.isArray(this._payload) ? this._payload : [this._payload];
        payload.forEach(p => rows.push(p));
        return { data: deepClone(payload), error: null };
      }

      if (this._op === "update") {
        const matches = filterRows(rows, this._filters);
        matches.forEach(r => Object.assign(r, this._payload || {}));
        return { data: deepClone(matches), error: null };
      }

      if (this._op === "delete") {
        const matches = filterRows(rows, this._filters);
        DEMO_DB[table] = rows.filter(r => !matches.includes(r));
        return { data: deepClone(matches), error: null };
      }

      return { data: null, error: null };
    }

    then(resolve, reject) {
      return this._exec().then(resolve, reject);
    }
  }

  const supabaseMock = {
    createClient: function () {
      return {
        auth: {
          getSession: async () => ({ data: { session: deepClone(demoSession) }, error: null }),
          getUser: async () => ({ data: { user: deepClone(demoSession.user) }, error: null }),
          onAuthStateChange: (cb) => {
            try { cb("SIGNED_IN", deepClone(demoSession)); } catch (_) {}
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signInWithPassword: async () => ({ data: { user: deepClone(demoSession.user), session: deepClone(demoSession) }, error: null }),
          signUp: async () => ({ data: { user: deepClone(demoSession.user), session: deepClone(demoSession) }, error: null }),
          signOut: async () => ({ error: null })
        },
        from: (table) => new Query(table)
      };
    }
  };

  // Lock supabase global so app.js uses our mock even if the CDN loads.
  try {
    Object.defineProperty(window, "supabase", {
      configurable: true,
      get: () => supabaseMock,
      set: () => {}
    });
  } catch (e) {
    window.supabase = supabaseMock;
  }

  // -----------------------------
  // Fetch interception:
  // - Block writes to Supabase/API (POST/PUT/PATCH/DELETE)
  // - Allow GETs (or return mocked stubs if needed)
  // -----------------------------
  const realFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = (typeof input === "string") ? input : (input && input.url ? input.url : "");
    const method = (init && init.method ? String(init.method).toUpperCase() : "GET");

    // Block any non-GET requests to Supabase / API (no real writes)
    if ((SUPABASE_HOST_RE.test(url) || API_HOST_RE.test(url)) && method !== "GET") {
      // In-memory only: pretend success
      return new Response(JSON.stringify({ ok: true, demo: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return realFetch(input, init);
  };

  // Optional: small banner marker in demo
  window.addEventListener("DOMContentLoaded", () => {
    try {
      const tag = document.createElement("div");
      tag.textContent = "DEMO – Änderungen werden nicht gespeichert";
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

// Hard bypass for any auth UI that still renders.
// Wait until app exposes its view helpers, then force app view.
(function forceDemoAppView() {
  const start = Date.now();
  const max = 8000; // ms

  const timer = setInterval(() => {
    try {
      // viele deiner Projekte haben showAuthView/showAppView oder ähnliche helpers
      if (typeof window.showAppView === "function") {
        // falls es eine login view gibt, wegbügeln
        if (typeof window.showAuthView === "function") {
          // nichts – wir zeigen einfach App
        }

        // Optional: falls es Wrapper gibt
        const auth = document.getElementById("auth-view") || document.querySelector(".auth-view");
        if (auth) auth.style.display = "none";

        const app = document.getElementById("app-view") || document.querySelector(".app-view");
        if (app) app.style.display = "";

        window.showAppView();
        clearInterval(timer);
        return;
      }

      // Fallback: wenn deine App statt showAppView mit Klassen arbeitet
      const loginScreen = document.querySelector("#login-screen, .login-screen, #auth, .auth");
      const appShell = document.querySelector("#app, .app, #app-shell, .app-shell");
      if (appShell && loginScreen) {
        loginScreen.style.display = "none";
        appShell.style.display = "";
        clearInterval(timer);
        return;
      }
    } catch (e) {}
    if (Date.now() - start > max) clearInterval(timer);
  }, 80);
})();
