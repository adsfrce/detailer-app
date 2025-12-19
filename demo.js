// DetailHQ Demo Overlay
// - Fake session (always signed in)
// - In-memory DB (services, vehicle classes, bookings)
// - Rolling dates: "today booking" is always today, even weeks later
// - Blocks real writes to Supabase/API

(function () {
  "use strict";

  // -----------------------------
  // Config
  // -----------------------------
  const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
  const DEMO_EMAIL = "demo@detailhq.de";
  const DEMO_COMPANY = "DetailHQ Demo Studio";

  // domains (used to block writes)
  const SUPABASE_HOST_RE = /\.supabase\.co\b/i;
  const API_HOST_RE = /api\.detailhq\.de\b/i;

  // -----------------------------
  // Utilities
  // -----------------------------
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function iso(d) {
    return new Date(d).toISOString();
  }

  function addDays(base, days) {
    const x = new Date(base);
    x.setDate(x.getDate() + days);
    return x;
  }

  function addMinutes(base, mins) {
    const x = new Date(base);
    x.setMinutes(x.getMinutes() + mins);
    return x;
  }

  function setTime(base, hh, mm) {
    const x = new Date(base);
    x.setHours(hh, mm, 0, 0);
    return x;
  }
  
  // -----------------------------
  // Rolling "today" anchor
  // -----------------------------
  const now = new Date();
  now.setSeconds(0, 0);
  const today = new Date(now);
  today.setHours(0,0,0,0);

  // -----------------------------
  // SERVICES (deine Zeiten!)
  // Hinweis: Bei "Tage" rechnen wir mit 8h/Tag, damit UI nicht komplett eskaliert.
  // -----------------------------
  const DEMO_SERVICES = [
    {
      id: "svc-ppf",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Lackschutz / PPF",
      name: "PPF – Frontpaket (Premium)",
      description: "Stoßfänger, Motorhaube (Teil), Kotflügel (Teil), Spiegel.",
      base_price_cents: 169900, // 1.699 €
      duration_minutes: Math.round(3.5 * 8 * 60), // 3–4 Tage -> 3.5 Arbeitstage
      is_active: true
    },
    {
      id: "svc-wrap",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Folierung",
      name: "Vollfolierung",
      description: "Vollfolierung inkl. Demontage/Kanten, Premium-Folie.",
      base_price_cents: 249900, // 2.499 €
      duration_minutes: Math.round(2 * 8 * 60), // 2 Tage
      is_active: true
    },
    {
      id: "svc-ceramic",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Keramikversiegelung",
      name: "Keramikversiegelung (2–3 Jahre)",
      description: "Lack vorbereiten, entfetten, 1–2 Schichten, Aushärtung.",
      base_price_cents: 89900, // 899 €
      duration_minutes: 12 * 60, // 12h
      is_active: true
    },
    {
      id: "svc-paintcorrection",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Lackkorrektur",
      name: "Lackkorrektur (1-Step / Finish)",
      description: "Maschinelle Politur, Glanz- & Defektkorrektur.",
      base_price_cents: 74900, // 749 €
      duration_minutes: 10 * 60, // 10h
      is_active: true
    },
    {
      id: "svc-detailing",
      detailer_id: DEMO_USER_ID,
      kind: "service",
      category: "Aufbereitung",
      name: "Innen & Außen Aufbereitung",
      description: "Handwäsche, Innenraum, Felgen, Glas, Finish.",
      base_price_cents: 29900, // 299 €
      duration_minutes: Math.round(5.5 * 60), // 5–6h
      is_active: true
    }
  ];

  // -----------------------------
  // VEHICLE CLASSES (Preset)
  // -----------------------------
  const DEMO_VEHICLE_CLASSES = [
    { id: "vc-1", detailer_id: DEMO_USER_ID, name: "Kompaktklasse", price_delta_cents: 0 },
    { id: "vc-2", detailer_id: DEMO_USER_ID, name: "Mittelklasse", price_delta_cents: 4900 },
    { id: "vc-3", detailer_id: DEMO_USER_ID, name: "Obere Mittelklasse", price_delta_cents: 9900 },
    { id: "vc-4", detailer_id: DEMO_USER_ID, name: "Oberklasse", price_delta_cents: 14900 },
    { id: "vc-5", detailer_id: DEMO_USER_ID, name: "SUV / VAN", price_delta_cents: 12900 },
    { id: "vc-6", detailer_id: DEMO_USER_ID, name: "Sportwagen", price_delta_cents: 19900 }
  ];

  // -----------------------------
  // 15 BOOKINGS, rolling (heute bleibt immer heute)
  // über ~6–7 Tage verteilt, gemischte Status
  // -----------------------------
  function generateBookings() {
    const names = [
      "Lukas Schneider","Nina Fischer","Maximilian Weber","Sarah Hoffmann","Tim Neumann",
      "Leonie Wagner","Jonas Becker","Laura Klein","Paul Richter","Marie Wolf",
      "Felix Braun","Anna Krüger","David König","Sophie Hartmann","Jan Zimmermann"
    ];

    const cars = [
      "BMW 540i G30","Audi S6 C8","Mercedes E53 AMG","Porsche 911 Carrera (992)",
      "BMW M3 G80","Audi RS5","Mercedes C63 AMG","Porsche Taycan 4S",
      "BMW X5 M50i","Audi SQ7","Mercedes S500","BMW 750i",
      "Porsche Cayman GTS 4.0","Audi RS3 8Y","Mercedes AMG GT"
    ];

    const svcIds = ["svc-detailing","svc-paintcorrection","svc-ceramic","svc-wrap","svc-ppf"];
    const jobStatuses = ["requested","planned","in_progress","done","canceled","proposed"];
    const payStatuses = ["unpaid","partial","paid","refunded"];

    // Verteilung: 1 gestern, 4 heute, Rest +1 bis +6 Tage
    const offsets = [-1, 0,0,0,0, 1,1, 2,2, 3,3, 4,4, 5,6];

    const out = [];
    for (let i = 0; i < 15; i++) {
      const startBase = new Date(today);
      const startDay = new Date(startBase);
      startDay.setDate(startDay.getDate() + offsets[i]);

      // Slots über den Tag streuen
      const startHour = [8,9,10,11,12,13,14,15][i % 8];
      const startAt = new Date(startDay);
      startAt.setHours(startHour, 0, 0, 0);

      const service_id = svcIds[i % svcIds.length];
      const svc = DEMO_SERVICES.find(s => s.id === service_id);
      const durMin = svc ? Number(svc.duration_minutes || 180) : 180;

      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + durMin);

      const vehicleClassId = (i % 5 === 0) ? "vc-6" : (i % 3 === 0) ? "vc-4" : "vc-3";

      out.push({
        id: 1001 + i,
        detailer_id: DEMO_USER_ID,
        customer_name: names[i],
        customer_email: `kunde${i+1}@example.de`,
        customer_phone: "+49 170 1234567",
        vehicle_name: cars[i],
        vehicle_class_id: vehicleClassId,
        service_id,
        service_name: svc ? svc.name : "Service",
        category: svc ? svc.category : "",
        notes: i % 4 === 0 ? "Kunde wünscht Abholung bis 18:00." : "",
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        status: jobStatuses[i % jobStatuses.length],
        job_status: jobStatuses[i % jobStatuses.length],
        payment_status: payStatuses[(i + 1) % payStatuses.length],
        total_price: Math.round(((svc ? svc.base_price_cents : 29900) / 100)),
        created_at: new Date(now.getTime() - (i * 3600 * 1000)).toISOString()
      });
    }
    return out;
  }

  // -----------------------------
  // DEMO_DB (das ist der Kern warum bei dir aktuell alles leer ist)
  // -----------------------------
  const DEMO_DB = {
    profiles: [
      {
        id: DEMO_USER_ID,
        company_name: DEMO_COMPANY,
        full_name: "Demo Admin",
        plan_status: "active",
        trial_ends_at: null,
        opening_hours: {
          mon: { open: true, start: "08:00", end: "18:00" },
          tue: { open: true, start: "08:00", end: "18:00" },
          wed: { open: true, start: "08:00", end: "18:00" },
          thu: { open: true, start: "08:00", end: "18:00" },
          fri: { open: true, start: "08:00", end: "18:00" },
          sat: { open: true, start: "09:00", end: "14:00" },
          sun: { open: false, start: null, end: null }
        },
        public_daily_limit: 4
      }
    ],
    vehicle_classes: deepClone(DEMO_VEHICLE_CLASSES),
    services: deepClone(DEMO_SERVICES),
    bookings: generateBookings(),
    signup_events: []
  };
  
  // -----------------------------
  // Kill any real Supabase auth persistence (your “random account”)
  // -----------------------------
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach((k) => {
      if (!k) return;
      // typical supabase keys: sb-<project>-auth-token, supabase.auth.token, etc.
      if (k.startsWith("sb-") || k.includes("supabase") || k.includes("auth-token")) {
        localStorage.removeItem(k);
      }
    });
  } catch (_) {}

  // -----------------------------
  // Rolling "today" anchor (recomputed on every load)
  // -----------------------------
  const today = new Date();
  today.setSeconds(0, 0);

  // -----------------------------
  // Services (your requested set)
  // durations:
  // - Folierung 2 Tage
  // - PPF 3-4 Tage
  // - Keramik 12h
  // - Lackkorrektur 10h
  // - Aufbereitung 5-6h
  // We'll model a "work day" as 8h for the day-based services.
  // -----------------------------
  const SERVICE_DURATION_MIN = {
    "svc-ppf": Math.round(3.5 * 8 * 60),          // 3.5 Tage -> 28h
    "svc-wrap": Math.round(2 * 8 * 60),           // 2 Tage -> 16h
    "svc-ceramic": 12 * 60,                       // 12h
    "svc-paintcorrection": 10 * 60,               // 10h
    "svc-detailing": Math.round(5.5 * 60)         // 5.5h
  };

  const DEMO_SERVICES = [
    {
      id: "svc-ppf",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Lackschutz / PPF",
      name: "PPF – Frontpaket (Premium)",
      description: "Stoßfänger, Motorhaube (Teil), Kotflügel (Teil), Spiegel. Steinschlag-Schutz mit sauberer Kantenarbeit.",
      base_price_cents: 199000,
      duration_minutes: SERVICE_DURATION_MIN["svc-ppf"]
    },
    {
      id: "svc-wrap",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Folierung",
      name: "Folierung – Komplett (Farbwechsel)",
      description: "Premium Vinyl. Preis abhängig von Fahrzeuggröße & Komplexität, inkl. Finish/Details.",
      base_price_cents: 249000,
      duration_minutes: SERVICE_DURATION_MIN["svc-wrap"]
    },
    {
      id: "svc-ceramic",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Keramikversiegelung",
      name: "Keramikversiegelung (3–5 Jahre)",
      description: "Intensive Vorreinigung + Vorbereitung + Coating. Hydrophob, Glanz, einfache Pflege.",
      base_price_cents: 99900,
      duration_minutes: SERVICE_DURATION_MIN["svc-ceramic"]
    },
    {
      id: "svc-paintcorrection",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Lackkorrektur",
      name: "Lackkorrektur (2-Step)",
      description: "Swirls/Hologramme raus, maximaler Glanz. Ideal vor Keramik oder Verkauf.",
      base_price_cents: 119900,
      duration_minutes: SERVICE_DURATION_MIN["svc-paintcorrection"]
    },
    {
      id: "svc-detailing",
      detailer_id: DEMO_USER_ID,
      kind: "package",
      category: "Aufbereitung",
      name: "Aufbereitung – Innen & Außen (Premium)",
      description: "Handwäsche, Dekontamination light, Innenraum intensiv, Scheiben, Felgen, Finish.",
      base_price_cents: 39900,
      duration_minutes: SERVICE_DURATION_MIN["svc-detailing"]
    }
  ];

  // -----------------------------
  // Vehicle classes (your app expects price_delta_cents + sort_order)
  // If your UI creates defaults, that's fine; here we provide them so it’s never empty.
  // -----------------------------
  const DEMO_VEHICLE_CLASSES = [
    { id: "vc-1", detailer_id: DEMO_USER_ID, name: "Kleinwagen",        price_delta_cents: 0,     sort_order: 1 },
    { id: "vc-2", detailer_id: DEMO_USER_ID, name: "Limo / Kombi",      price_delta_cents: 2000,  sort_order: 2 },
    { id: "vc-3", detailer_id: DEMO_USER_ID, name: "SUV / Transporter", price_delta_cents: 4000,  sort_order: 3 }
  ];

  // -----------------------------
  // 15 rolling bookings across ~7 days
  // - Some yesterday, several today, rest next days
  // - Many job_status + payment_status combinations
  // -----------------------------
  function generateBookings() {
    const statuses = ["geplant", "in_arbeit", "fertig", "storniert", "no_show"];
    const payments = ["bezahlt", "offen", "teilzahlung"];

    const customers = [
      { name: "Maximilian Schneider", email: "maximilian.schneider@example.com", phone: "+49 151 23847612" },
      { name: "Leonie Wagner",        email: "leonie.wagner@example.com",        phone: "+49 160 39811244" },
      { name: "Emre Yilmaz",          email: "emre.yilmaz@example.com",          phone: "+49 176 77120933" },
      { name: "Sophie Becker",        email: "sophie.becker@example.com",        phone: "+49 152 44019821" },
      { name: "Jonas Klein",          email: "jonas.klein@example.com",          phone: "+49 171 55201398" },
      { name: "Daniela Fischer",      email: "daniela.fischer@example.com",      phone: "+49 157 99110221" },
      { name: "Tobias Hoffmann",      email: "tobias.hoffmann@example.com",      phone: "+49 151 88340177" },
      { name: "Nina Bauer",           email: "nina.bauer@example.com",           phone: "+49 160 77114402" },
      { name: "Sebastian Neumann",    email: "sebastian.neumann@example.com",    phone: "+49 176 44490112" },
      { name: "Laura Richter",        email: "laura.richter@example.com",        phone: "+49 152 67110990" }
    ];

    const cars = [
      "BMW 540i • Dunkelblau",
      "Audi A6 Avant • Grau",
      "Mercedes E53 AMG • Schwarz",
      "BMW M3 Competition • Schwarz",
      "Audi RS6 Avant • Grau",
      "Porsche 911 Carrera S • Blau",
      "Porsche Taycan • Weiß",
      "BMW M5 • Schwarz",
      "Mercedes S500 • Anthrazit",
      "Mercedes-AMG GT • Grau",
      "Audi Q8 • Schwarz",
      "BMW X5 M • Schwarz",
      "Audi RS3 • Rot",
      "Porsche Cayman GTS • Gelb",
      "Mercedes C63 S • Silber"
    ];

    // distribute days: 1x yesterday, 4x today, rest next 5–6 days
    const dayOffsets = [-1, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6];

    // start times (realistic)
    const times = [
      [8, 0],
      [9, 0],
      [10, 30],
      [12, 0],
      [13, 30],
      [15, 0],
      [16, 30]
    ];

    const svcIds = ["svc-ppf", "svc-wrap", "svc-ceramic", "svc-paintcorrection", "svc-detailing"];

    const out = [];
    for (let i = 0; i < 15; i++) {
      const dayOffset = dayOffsets[i] ?? (i % 7);
      const t = times[i % times.length];

      const start = setTime(addDays(today, dayOffset), t[0], t[1]);

      const service_id = svcIds[i % svcIds.length];
      const duration = SERVICE_DURATION_MIN[service_id] ?? 180;
      const end = addMinutes(start, Math.min(duration, 8 * 60)); // UI: show a reasonable block

      const c = customers[i % customers.length];
      const car = cars[i % cars.length];

      const job_status = statuses[i % statuses.length];
      const payment_status = payments[(i + 2) % payments.length];

      const svc = DEMO_SERVICES.find(s => s.id === service_id);
      const basePrice = svc ? svc.base_price_cents : 19900;
      const classId = (i % 3 === 0) ? "vc-3" : (i % 3 === 1 ? "vc-2" : "vc-1");
      const classDelta = (classId === "vc-3") ? 4000 : (classId === "vc-2" ? 2000 : 0);

      const totalCents = basePrice + classDelta;

      const notes =
        i % 5 === 0 ? "Kundenwunsch: Fokus auf Felgen + Innenraum, bitte Swirls prüfen." :
        i % 5 === 2 ? "Abholung am selben Tag. Schlüssel im Safe." :
        "";

      out.push({
        id: `demo-booking-${i + 1}`,
        detailer_id: DEMO_USER_ID,

        customer_name: c.name,
        customer_email: c.email,
        customer_phone: c.phone,
        customer_address: "Karlsruhe, DE",

        car,
        notes,

        start_at: iso(start),
        end_at: iso(end),

        // your app uses either job_status or status (it maps status -> job_status sometimes)
        job_status,
        status: job_status,

        payment_status,

        // app stores total_price as number (EUR)
        total_price: Math.round(totalCents) / 100,

        vehicle_class_id: classId,
        service_id,
        service_name: svc ? svc.name : "Auftrag",

        duration_minutes: duration
      });
    }

    return out;
  }

  // -----------------------------
  // Demo DB
  // -----------------------------
  const DEMO_DB = {
    profiles: [
      {
        id: DEMO_USER_ID,
        company_name: DEMO_COMPANY,
        booking_slug: "DEMO",
        calendar_url: "https://calendar.google.com/calendar/u/0/r",
        review_url: "https://g.page/r/demo-review",
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
    vehicle_classes: deepClone(DEMO_VEHICLE_CLASSES),
    services: deepClone(DEMO_SERVICES),
    bookings: generateBookings(),
    signup_events: []
  };

  // -----------------------------
  // Fake auth/session
  // -----------------------------
  const demoSession = {
    access_token: "demo-access-token",
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    user: { id: DEMO_USER_ID, email: DEMO_EMAIL }
  };

  // -----------------------------
  // Query + filtering (Supabase-like)
  // Supports:
  // - select(cols, { count, head })
  // - insert/update/delete
  // - eq/gte/lt
  // - order
  // - single
  // -----------------------------
  function filterRows(rows, filters) {
    let out = rows.slice();
    for (const f of filters) {
      const { op, col, val } = f;
      if (op === "eq")  out = out.filter(r => String(r[col]) === String(val));
      if (op === "gte") out = out.filter(r => (r[col] || "") >= val);
      if (op === "lt")  out = out.filter(r => (r[col] || "") < val);
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
      this._selectOpts = null;
    }

    select(_cols = "*", opts = null) {
      this._op = "select";
      this._selectOpts = opts || null;
      return this;
    }

    insert(payload) { this._op = "insert"; this._payload = payload; return this; }
    update(payload) { this._op = "update"; this._payload = payload; return this; }
    delete() { this._op = "delete"; return this; }

    eq(col, val)  { this._filters.push({ op: "eq",  col, val }); return this; }
    gte(col, val) { this._filters.push({ op: "gte", col, val }); return this; }
    lt(col, val)  { this._filters.push({ op: "lt",  col, val }); return this; }

    order(col, opts) {
      this._order = { col, asc: !!(opts && opts.ascending) };
      return this;
    }

    single() { this._single = true; return this; }
    maybeSingle() { this._single = true; return this; }

    async _exec() {
      const table = this.table;
      const rows = DEMO_DB[table] ? DEMO_DB[table] : [];

      if (this._op === "select") {
        let out = filterRows(rows, this._filters);

        if (this._order) {
          const { col, asc } = this._order;
          out.sort((a, b) => (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1));
        }

        // support { count: "exact", head: true }
        const wantsCount = this._selectOpts && this._selectOpts.count === "exact";
        const headOnly = this._selectOpts && this._selectOpts.head === true;

        if (headOnly) {
          return { data: null, error: null, count: wantsCount ? out.length : null };
        }

        const data = this._single ? (out[0] || null) : out;
        return { data: deepClone(data), error: null, count: wantsCount ? out.length : null };
      }

      if (this._op === "insert") {
        const payloadArr = Array.isArray(this._payload) ? this._payload : [this._payload];
        payloadArr.forEach((p) => rows.push(p));
        DEMO_DB[table] = rows;
        return { data: deepClone(payloadArr), error: null };
      }

      if (this._op === "update") {
        const matches = filterRows(rows, this._filters);
        matches.forEach((r) => Object.assign(r, this._payload || {}));
        return { data: deepClone(matches), error: null };
      }

      if (this._op === "delete") {
        const matches = filterRows(rows, this._filters);
        DEMO_DB[table] = rows.filter((r) => !matches.includes(r));
        return { data: deepClone(matches), error: null };
      }

      return { data: null, error: null };
    }

    then(resolve, reject) {
      return this._exec().then(resolve, reject);
    }
  }

  // -----------------------------
  // Supabase mock (global)
  // -----------------------------
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

  // force app.js to always see our mock, even if CDN supabase loads
  try {
    Object.defineProperty(window, "supabase", {
      configurable: true,
      get: () => supabaseMock,
      set: () => {}
    });
  } catch (_) {
    window.supabase = supabaseMock;
  }

  // -----------------------------
  // Block real writes to Supabase/API (POST/PUT/PATCH/DELETE)
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
  // Small demo marker
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

})();
