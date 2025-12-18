// DetailHQ Demo Overlay
// - No login required (fake session)
// - No real saving (writes are blocked or kept in-memory until reload)
// - Read endpoints return deterministic demo data relative to 'today'

(function () {
  "use strict";

  const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
  const DEMO_EMAIL = "demo@detailhq.de";
  const DEMO_COMPANY = "Demo Detailing Studio";

  const SUPABASE_HOST_RE = /\.supabase\.co\b/i;
  const API_HOST_RE = /api\.detailhq\.de\b/i;

  function iso(d) { return new Date(d).toISOString(); }
  function addMinutes(d, mins) { const x = new Date(d); x.setMinutes(x.getMinutes() + mins); return x; }
  function addDays(d, days) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
  function setTime(base, hh, mm) { const x = new Date(base); x.setHours(hh, mm, 0, 0); return x; }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  // -----------------------------
  // Services + Durations (minutes)
  // -----------------------------
  const SERVICE_DURATION_MIN = {
    "svc-wrap": 960,            // Folierung ~ 2 Tage à 8h
    "svc-ppf": 1680,            // PPF ~ 3.5 Tage à 8h
    "svc-ceramic": 720,         // Keramik 12h
    "svc-paintcorrection": 600, // Lackkorrektur 10h
    "svc-detailing": 360        // Aufbereitung 5–6h (hier 6h)
  };

  const DEMO_SERVICES = [
    {
      id: "svc-ppf",
      detailer_id: DEMO_USER_ID,
      name: "Lackschutzfolie (PPF) – Frontpaket",
      price: 1690,
      type: "package",
      description: "Frontpaket inkl. Spiegel. Dauer: 3–4 Tage."
    },
    {
      id: "svc-wrap",
      detailer_id: DEMO_USER_ID,
      name: "Folierung – Komplett (Farbwechsel)",
      price: 2990,
      type: "package",
      description: "Premium Vinyl. Dauer: ca. 2 Tage."
    },
    {
      id: "svc-ceramic",
      detailer_id: DEMO_USER_ID,
      name: "Keramikversiegelung (3–5 Jahre)",
      price: 1290,
      type: "package",
      description: "Aufbereitung + Coating. Dauer: ca. 12h."
    },
    {
      id: "svc-paintcorrection",
      detailer_id: DEMO_USER_ID,
      name: "Lackkorrektur (2-Step)",
      price: 990,
      type: "package",
      description: "Swirls/Hologramme raus. Dauer: ca. 10h."
    },
    {
      id: "svc-detailing",
      detailer_id: DEMO_USER_ID,
      name: "Aufbereitung – Innen & Außen (Premium)",
      price: 399,
      type: "package",
      description: "Innenraum intensiv + Außen. Dauer: ca. 5–6h."
    }
  ];

  function generateBookings() {
    const base = new Date();
    base.setSeconds(0, 0);

    // Wenn deine App EN keys erwartet, sind das die sichersten:
    const statuses = ["scheduled", "in_progress", "completed", "cancelled", "no_show"];
    const pay = ["paid", "unpaid", "partial"];

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

    // Slots: nicht 15x heute. Verteilt über 0..6 Tage.
    const times = [
      [8, 0], [9, 0], [10, 30], [12, 0],
      [13, 30], [15, 0], [16, 30]
    ];

    const svcIds = ["svc-ppf", "svc-wrap", "svc-ceramic", "svc-paintcorrection", "svc-detailing"];
    const svcPrice = {
      "svc-ppf": 1690,
      "svc-wrap": 2990,
      "svc-ceramic": 1290,
      "svc-paintcorrection": 990,
      "svc-detailing": 399
    };

    const out = [];
    for (let i = 0; i < 15; i++) {
      const dayOffset = i % 7;               // rolling window über 7 Tage
      const t = times[i % times.length];
      const start = setTime(addDays(base, dayOffset), t[0], t[1]);

      const service_id = svcIds[i % svcIds.length];
      const duration = SERVICE_DURATION_MIN[service_id] ?? 180;
      const end = addMinutes(start, duration);

      const c = customers[i % customers.length];
      const car = cars[i % cars.length];

      out.push({
        id: `demo-booking-${i + 1}`,
        detailer_id: DEMO_USER_ID,
        customer_name: c.name,
        customer_email: c.email,
        customer_phone: c.phone,
        customer_address: "Karlsruhe, DE",
        car,
        notes: (i % 4 === 0) ? "Kundenwunsch: Fokus auf Felgen + Innenraum, bitte Swirls prüfen." : "",
        start_at: iso(start),
        end_at: iso(end),
        status: statuses[i % statuses.length],
        payment_status: pay[(i + 1) % pay.length],
        total_price: svcPrice[service_id] ?? 199,
        vehicle_class_id: (i % 3 === 0) ? "vc-2" : "vc-1",
        service_id
      });
    }

    return out;
  }

  const DEMO_DB = {
    profiles: [
      {
        id: DEMO_USER_ID,
        company_name: DEMO_COMPANY,
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
    services: deepClone(DEMO_SERVICES),
    bookings: generateBookings(),
    signup_events: []
  };

  const demoSession = {
    access_token: "demo-access-token",
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    user: { id: DEMO_USER_ID, email: DEMO_EMAIL }
  };

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
      this._op = "select";
      this._payload = null;
    }
    select() { this._op = "select"; return this; }
    insert(payload) { this._op = "insert"; this._payload = payload; return this; }
    update(payload) { this._op = "update"; this._payload = payload; return this; }
    delete() { this._op = "delete"; return this; }
    eq(col, val) { this._filters.push({ op: "eq", col, val }); return this; }
    gte(col, val) { this._filters.push({ op: "gte", col, val }); return this; }
    lt(col, val) { this._filters.push({ op: "lt", col, val }); return this; }
    order(col, opts) { this._order = { col, asc: !!(opts && opts.ascending) }; return this; }
    single() { this._single = true; return this; }

    async _exec() {
      const rows = DEMO_DB[this.table] ? DEMO_DB[this.table] : [];

      if (this._op === "select") {
        let out = filterRows(rows, this._filters);
        if (this._order) {
          const { col, asc } = this._order;
          out.sort((a, b) => (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1));
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
        DEMO_DB[this.table] = rows.filter(r => !matches.includes(r));
        return { data: deepClone(matches), error: null };
      }

      return { data: null, error: null };
    }

    then(resolve, reject) { return this._exec().then(resolve, reject); }
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
          signOut: async () => ({ error: null })
        },
        from: (table) => new Query(table)
      };
    }
  };

  // Ensure app.js sees our supabase mock
  try {
    Object.defineProperty(window, "supabase", {
      configurable: true,
      get: () => supabaseMock,
      set: () => {}
    });
  } catch (_) {
    window.supabase = supabaseMock;
  }

  // Block any real writes
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = (typeof input === "string") ? input : (input && input.url ? input.url : "");
    const method = (init && init.method ? String(init.method).toUpperCase() : "GET");
    if ((SUPABASE_HOST_RE.test(url) || API_HOST_RE.test(url)) && method !== "GET") {
      return new Response(JSON.stringify({ ok: true, demo: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return realFetch(input, init);
  };

  // Settings subview fallback (Service / Business)
  function normalizeKey(s) { return String(s || "").toLowerCase().trim(); }

  function showSubviewFallback(key) {
    const k = normalizeKey(key);

    const candidates = [
      ["showSettingsSubview", [k]],
      ["openSettingsSubview", [k]],
      ["navigateSettingsSubview", [k]],
      ["setSettingsSubview", [k]],
      ["showSettingsView", []]
    ];

    for (const [fn, args] of candidates) {
      if (typeof window[fn] === "function") {
        try { window[fn](...args); } catch (_) {}
      }
    }

    const allPanels = Array.from(document.querySelectorAll(
      "[data-settings-subview], .settings-subview, .settings-view__subview, .subview"
    ));

    const panel =
      document.querySelector(`[data-settings-subview="${k}"]`) ||
      document.getElementById(`settings-${k}`) ||
      document.getElementById(`settings-subview-${k}`) ||
      document.querySelector(`.settings-subview--${k}`) ||
      document.querySelector(`#${k}-subview`) ||
      document.querySelector(`.${k}-subview`);

    if (allPanels.length) {
      allPanels.forEach(p => { p.classList.add("hidden"); p.style.display = "none"; });
    }
    if (panel) { panel.classList.remove("hidden"); panel.style.display = ""; }
  }

  document.addEventListener("click", (e) => {
    const el = e.target && e.target.closest ? e.target.closest("button,a,[role='button']") : null;
    if (!el) return;

    const id = normalizeKey(el.id);
    const txt = normalizeKey(el.textContent);
    const data = normalizeKey(el.getAttribute("data-subview") || el.getAttribute("data-settings-subview"));

    const wantsServices =
      data === "services" || data === "service" ||
      id.includes("service") || id.includes("services") ||
      txt.includes("service") || txt.includes("services") || txt.includes("leistung");

    const wantsBusiness =
      data === "business" || data === "unternehmen" ||
      id.includes("business") || id.includes("company") || id.includes("unternehmen") ||
      txt.includes("business") || txt.includes("unternehmen");

    if (wantsServices) showSubviewFallback("services");
    if (wantsBusiness) showSubviewFallback("business");
  }, true);

  // Demo marker
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
