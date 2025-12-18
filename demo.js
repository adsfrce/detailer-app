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
  // "Rolling today" anchor
  // -----------------------------
  // Wichtig: Bei jedem Öffnen wird "today" neu relativ bestimmt,
  // sodass "heute" in 7 Tagen wieder "heute" ist (rolling).
  const today = new Date();
  today.setSeconds(0, 0);

  // -----------------------------
  // Demo services (dein Wunsch)
  // -----------------------------
  const DEMO_SERVICES = [
    {
      id: "svc-ppf",
      detailer_id: DEMO_USER_ID,
      name: "Lackschutzfolie (PPF) – Frontpaket",
      price: 1590,
      type: "package",
      description: "Stoßfänger, Motorhaube (Teil), Kotflügel (Teil), Spiegel. Steinschlag-Schutz."
    },
    {
      id: "svc-wrap",
      detailer_id: DEMO_USER_ID,
      name: "Folierung – Komplett (Farbwechsel)",
      price: 2990,
      type: "package",
      description: "Premium Vinyl, inkl. Demontage kleiner Anbauteile. Preis je nach Fahrzeug/Komplexität."
    },
    {
      id: "svc-ceramic",
      detailer_id: DEMO_USER_ID,
      name: "Keramikversiegelung (3–5 Jahre)",
      price: 1290,
      type: "package",
      description: "One-step Polish + Coating. Hydrophob, Glanz, leichte Reinigung."
    },
    {
      id: "svc-paintcorrection",
      detailer_id: DEMO_USER_ID,
      name: "Lackkorrektur (2-Step)",
      price: 890,
      type: "package",
      description: "Swirls/Hologramme raus, tiefer Glanz. Ideal vor Keramik."
    },
    {
      id: "svc-detailing",
      detailer_id: DEMO_USER_ID,
      name: "Aufbereitung – Innen & Außen (Premium)",
      price: 349,
      type: "package",
      description: "Handwäsche, Dekontamination light, Innenraum intensiv, Scheiben, Felgen."
    }
  ];

  // -----------------------------
  // Demo bookings (15, rolling, varied)
  // -----------------------------
  function generateBookings() {
    const base = new Date();
    base.setSeconds(0, 0);

    // Viele verschiedene Status/Payment-States verteilt
    const statuses = [
      "geplant",
      "in_arbeit",
      "fertig",
      "storniert",
    ];

    const pay = [
      "bezahlt",
      "offen",
      "teilzahlung"
    ];

    // Deutsche Namen (random-ish aber deterministisch via Reihenfolge)
    const customers = [
      { name: "Maximilian Schneider", email: "maximilian.schneider@example.com", phone: "+49 151 23847612" },
      { name: "Leonie Wagner", email: "leonie.wagner@example.com", phone: "+49 160 39811244" },
      { name: "Emre Yilmaz", email: "emre.yilmaz@example.com", phone: "+49 176 77120933" },
      { name: "Sophie Becker", email: "sophie.becker@example.com", phone: "+49 152 44019821" },
      { name: "Jonas Klein", email: "jonas.klein@example.com", phone: "+49 171 55201398" },
      { name: "Daniela Fischer", email: "daniela.fischer@example.com", phone: "+49 157 99110221" },
      { name: "Tobias Hoffmann", email: "tobias.hoffmann@example.com", phone: "+49 151 88340177" },
      { name: "Nina Bauer", email: "nina.bauer@example.com", phone: "+49 160 77114402" },
      { name: "Sebastian Neumann", email: "sebastian.neumann@example.com", phone: "+49 176 44490112" },
      { name: "Laura Richter", email: "laura.richter@example.com", phone: "+49 152 67110990" }
    ];

    // Oberklasse / obere Mittelklasse / Sportwagen
    const cars = [
      "BMW M3 Competition • Schwarz",
      "Audi RS6 Avant • Grau",
      "Mercedes-AMG C63 S • Silber",
      "Porsche 911 Carrera S • Blau",
      "BMW M5 • Schwarz",
      "Mercedes S500 • Anthrazit",
      "Audi A6 Avant • Weiß",
      "Porsche Taycan • Weiß",
      "BMW X5 M • Schwarz",
      "Mercedes-AMG GT • Grau",
      "Audi RS3 • Rot",
      "BMW 540i • Dunkelblau",
      "Mercedes E53 AMG • Schwarz",
      "Porsche Cayman GTS • Gelb",
      "Audi Q8 • Schwarz"
    ];

    // Zeiten so verteilt, dass es realistisch aussieht
    const times = [
      [8, 0],
      [9, 30],
      [10, 45],
      [12, 15],
      [13, 30],
      [15, 0],
      [16, 15],
      [17, 30]
    ];

    // Service rotation
    const svcIds = ["svc-ppf", "svc-wrap", "svc-ceramic", "svc-paintcorrection", "svc-detailing"];

    // Preise passend zu Services (wird als "total_price" reingeschrieben)
    const svcPrice = {
      "svc-ppf": 1590,
      "svc-wrap": 2990,
      "svc-ceramic": 1290,
      "svc-paintcorrection": 890,
      "svc-detailing": 349
    };

    const out = [];
    let idCounter = 1;

    // 15 Bookings: immer über die nächsten 0..6 Tage verteilt (rolling)
    for (let i = 0; i < 15; i++) {
      const dayOffset = i % 7; // rolling week window
      const t = times[i % times.length];

      const start = setTime(addDays(base, dayOffset), t[0], t[1]);

      // Dauer je Service etwas variieren
      const service_id = svcIds[i % svcIds.length];
      const duration =
        service_id === "svc-wrap" ? 300 :
        service_id === "svc-ppf" ? 240 :
        service_id === "svc-ceramic" ? 240 :
        service_id === "svc-paintcorrection" ? 180 :
        120;

      const end = addMinutes(start, duration);

      const c = customers[i % customers.length];
      const car = cars[i % cars.length];

      // Verteile Status & Payment bewusst gemischt
      const status = statuses[i % statuses.length];
      const payment_status = pay[(i + 2) % pay.length];

      const notes =
        i % 5 === 0 ? "Kundenwunsch: Fokus auf Felgen + Innenraum, bitte kleine Kratzer prüfen." :
        i % 5 === 2 ? "Abholung am selben Tag. Schlüssel im Safe." :
        "";

      out.push({
        id: `demo-booking-${idCounter++}`,
        detailer_id: DEMO_USER_ID,

        customer_name: c.name,
        customer_email: c.email,
        customer_phone: c.phone,
        customer_address: "Karlsruhe, DE",

        car,
        notes,

        start_at: iso(start),
        end_at: iso(end),

        status,
        payment_status,

        total_price: svcPrice[service_id] ?? 199,

        vehicle_class_id: i % 3 === 0 ? "vc-2" : "vc-1",
        service_id
      });
    }

    return out;
  }

  // -----------------------------
  // Demo DB (in-memory until reload)
  // -----------------------------
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

    // <<< dein neues Services-Set >>>
    services: deepClone(DEMO_SERVICES),

    // <<< 15 rolling Aufträge >>>
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
    user: { id: DEMO_USER_ID, email: DEMO_EMAIL }
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
  // - Allow GETs
  // -----------------------------
  const realFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = (typeof input === "string") ? input : (input && input.url ? input.url : "");
    const method = (init && init.method ? String(init.method).toUpperCase() : "GET");

    if ((SUPABASE_HOST_RE.test(url) || API_HOST_RE.test(url)) && method !== "GET") {
      return new Response(JSON.stringify({ ok: true, demo: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return realFetch(input, init);
  };

  // -----------------------------
  // Demo marker
  // -----------------------------
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

  // -----------------------------
  // FIX: Settings subview routing (Service / Business)
  // -----------------------------
  // Problem: In Demo/Defer/Timing kann es passieren, dass deine App-Handler nicht binden.
  // Lösung: Wir fangen Klicks ab und versuchen:
  // 1) vorhandene App-Funktionen zu callen (falls vorhanden)
  // 2) ansonsten: DOM-Fallback -> Panels show/hide
  function normalizeKey(s) {
    return String(s || "").toLowerCase().trim();
  }

  function showSubviewFallback(key) {
    const k = normalizeKey(key);

    // 1) Wenn App Helper existiert: nutzen
    const candidates = [
      ["showSettingsSubview", [k]],
      ["openSettingsSubview", [k]],
      ["navigateSettingsSubview", [k]],
      ["setSettingsSubview", [k]],
      ["showSettingsView", []] // ggf. erst settings view
    ];

    for (const [fn, args] of candidates) {
      if (typeof window[fn] === "function") {
        try {
          window[fn](...args);
          // nach dem Call nicht returnen: manche Apps setzen erst View, dann Subview
        } catch (_) {}
      }
    }

    // 2) DOM-Fallback:
    // - wir versuchen verbreitete Muster: data-subview, ids, classes
    const allPanels = Array.from(document.querySelectorAll(
      "[data-settings-subview], .settings-subview, .settings-view__subview, .subview"
    ));

    // Panel finden
    const panel =
      document.querySelector(`[data-settings-subview="${k}"]`) ||
      document.getElementById(`settings-${k}`) ||
      document.getElementById(`settings-subview-${k}`) ||
      document.querySelector(`.settings-subview--${k}`) ||
      document.querySelector(`#${k}-subview`) ||
      document.querySelector(`.${k}-subview`);

    if (allPanels.length) {
      allPanels.forEach(p => {
        // nur verstecken, wenn es wirklich ein Subview-Container ist
        p.classList.add("hidden");
        p.style.display = "none";
      });
    }

    if (panel) {
      panel.classList.remove("hidden");
      panel.style.display = "";
    }
  }

  // Click delegation: Buttons/Links die "service" / "business" heißen
  document.addEventListener("click", (e) => {
    const el = e.target && e.target.closest ? e.target.closest("button,a,[role='button']") : null;
    if (!el) return;

    const id = normalizeKey(el.id);
    const txt = normalizeKey(el.textContent);
    const data = normalizeKey(el.getAttribute("data-subview") || el.getAttribute("data-settings-subview"));

    const wantsServices =
      data === "services" || data === "service" ||
      id.includes("service") || id.includes("services") ||
      txt === "service" || txt === "services" || txt.includes("service");

    const wantsBusiness =
      data === "business" || data === "unternehmen" ||
      id.includes("business") || id.includes("company") || id.includes("unternehmen") ||
      txt === "business" || txt.includes("business") || txt.includes("unternehmen");

    if (wantsServices) {
      try { showSubviewFallback("services"); } catch (_) {}
    }

    if (wantsBusiness) {
      try { showSubviewFallback("business"); } catch (_) {}
    }
  }, true);

})();

// Hard bypass for any auth UI that still renders.
// Wait until app exposes its view helpers, then force app view.
(function forceDemoAppView() {
  const start = Date.now();
  const max = 8000; // ms

  const timer = setInterval(() => {
    try {
      if (typeof window.showAppView === "function") {
        const auth = document.getElementById("auth-view") || document.querySelector(".auth-view");
        if (auth) auth.style.display = "none";

        const app = document.getElementById("app-view") || document.querySelector(".app-view");
        if (app) app.style.display = "";

        window.showAppView();
        clearInterval(timer);
        return;
      }

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
