// DetailHQ Demo Overlay – REST Interceptor (works even if app imports Supabase as ESM)

(function () {
  "use strict";

  // 1) Kill any persisted real Supabase sessions (prevents "random user" login)
  try {
    const purge = (store) => {
      const keys = [];
      for (let i = 0; i < store.length; i++) keys.push(store.key(i));
      keys.forEach(k => {
        if (!k) return;
        const lk = k.toLowerCase();
        if (k.includes("sb-") || lk.includes("supabase") || lk.includes("auth-token")) {
          store.removeItem(k);
        }
      });
    };
    purge(window.localStorage);
    purge(window.sessionStorage);
  } catch (_) {}

  const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
  const DEMO_EMAIL = "demo@detailhq.de";
  const DEMO_COMPANY = "Demo Detailing Studio";

  const SUPABASE_HOST_RE = /\.supabase\.co\b/i;

  function iso(d) { return new Date(d).toISOString(); }
  function addMinutes(d, mins) { const x = new Date(d); x.setMinutes(x.getMinutes() + mins); return x; }
  function addDays(d, days) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
  function setTime(base, hh, mm) { const x = new Date(base); x.setHours(hh, mm, 0, 0); return x; }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  // Durations (minutes) as you specified
  const SERVICE_DURATION_MIN = {
    "svc-wrap": 960,            // Folierung ~ 2 Tage (16h)
    "svc-ppf": 1680,            // PPF ~ 3–4 Tage (28h)
    "svc-ceramic": 720,         // Keramik 12h
    "svc-paintcorrection": 600, // Lackkorrektur 10h
    "svc-detailing": 360        // Aufbereitung 6h
  };

  const DEMO_SERVICES = [
    { id: "svc-ppf", detailer_id: DEMO_USER_ID, name: "Lackschutzfolie (PPF) – Frontpaket", price: 1690, type: "package", description: "Frontpaket inkl. Spiegel. Dauer: 3–4 Tage." },
    { id: "svc-wrap", detailer_id: DEMO_USER_ID, name: "Folierung – Komplett (Farbwechsel)", price: 2990, type: "package", description: "Premium Vinyl. Dauer: ca. 2 Tage." },
    { id: "svc-ceramic", detailer_id: DEMO_USER_ID, name: "Keramikversiegelung (3–5 Jahre)", price: 1290, type: "package", description: "Aufbereitung + Coating. Dauer: ca. 12h." },
    { id: "svc-paintcorrection", detailer_id: DEMO_USER_ID, name: "Lackkorrektur (2-Step)", price: 990, type: "package", description: "Swirls/Hologramme raus. Dauer: ca. 10h." },
    { id: "svc-detailing", detailer_id: DEMO_USER_ID, name: "Aufbereitung – Innen & Außen (Premium)", price: 399, type: "package", description: "Innenraum intensiv + Außen. Dauer: ca. 5–6h." }
  ];

  function generateBookings() {
    const base = new Date();
    base.setSeconds(0, 0);

    // Use EN keys (most common in apps); if your DB uses DE keys, we can map after we see requests.
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

    const times = [[8,0],[9,0],[10,30],[12,0],[13,30],[15,0],[16,30]];
    const svcIds = ["svc-ppf", "svc-wrap", "svc-ceramic", "svc-paintcorrection", "svc-detailing"];
    const svcPrice = { "svc-ppf":1690, "svc-wrap":2990, "svc-ceramic":1290, "svc-paintcorrection":990, "svc-detailing":399 };

    const out = [];
    for (let i = 0; i < 15; i++) {
      const dayOffset = i % 7; // rolling over 7 days (today..+6)
      const t = times[i % times.length];
      const start = setTime(addDays(base, dayOffset), t[0], t[1]);

      const service_id = svcIds[i % svcIds.length];
      const duration = SERVICE_DURATION_MIN[service_id] ?? 180;
      const end = addMinutes(start, duration);

      const c = customers[i % customers.length];
      const car = cars[i % cars.length];

      out.push({
        id: `demo-booking-${i+1}`,
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

  // Demo DB
  const DEMO_DB = {
    profiles: [{ id: DEMO_USER_ID, company_name: DEMO_COMPANY }],
    vehicle_classes: [
      { id: "vc-1", detailer_id: DEMO_USER_ID, name: "PKW" },
      { id: "vc-2", detailer_id: DEMO_USER_ID, name: "SUV / VAN" }
    ],
    services: deepClone(DEMO_SERVICES),
    bookings: generateBookings()
  };

  // 2) REST filter helpers (PostgREST style)
  function applyPostgrestFilters(rows, url) {
    const qp = url.searchParams;
    let out = rows.slice();

    // Filters like: detailer_id=eq.<value>
    for (const [k, v] of qp.entries()) {
      if (k === "select" || k === "order" || k === "limit" || k === "offset") continue;
      if (!v) continue;
      const m = String(v).match(/^(\w+)\.(.*)$/); // eq.<val>, gte.<val>...
      if (!m) continue;
      const op = m[1];
      const raw = m[2];

      const val = decodeURIComponent(raw);

      if (op === "eq") out = out.filter(r => String(r[k]) === String(val));
      else if (op === "gte") out = out.filter(r => String(r[k]) >= String(val));
      else if (op === "lt") out = out.filter(r => String(r[k]) < String(val));
      // add more if needed
    }

    // order=col.asc / col.desc
    const order = qp.get("order");
    if (order) {
      const om = order.match(/^([a-zA-Z0-9_]+)\.(asc|desc)$/);
      if (om) {
        const col = om[1];
        const dir = om[2];
        out.sort((a, b) => {
          const av = a[col]; const bv = b[col];
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (dir === "asc" ? 1 : -1);
        });
      }
    }

    const offset = parseInt(qp.get("offset") || "0", 10);
    const limit = parseInt(qp.get("limit") || "0", 10);
    if (offset > 0) out = out.slice(offset);
    if (limit > 0) out = out.slice(0, limit);

    return out;
  }

  function isRestV1(urlObj) {
    return SUPABASE_HOST_RE.test(urlObj.hostname) && urlObj.pathname.includes("/rest/v1/");
  }

  function tableFromRest(urlObj) {
    const idx = urlObj.pathname.indexOf("/rest/v1/");
    const after = urlObj.pathname.slice(idx + "/rest/v1/".length);
    return after.split("/")[0] || "";
  }

  function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...extraHeaders }
    });
  }

  // 3) Fetch interception (GET to Supabase REST) + (GET to auth user)
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const urlStr = (typeof input === "string") ? input : (input && input.url ? input.url : "");
    const method = (init && init.method ? String(init.method).toUpperCase() : "GET");

    let urlObj;
    try { urlObj = new URL(urlStr, window.location.origin); } catch (_) { return realFetch(input, init); }

    // Intercept auth user endpoint -> always demo user
    if (SUPABASE_HOST_RE.test(urlObj.hostname) && urlObj.pathname.includes("/auth/v1/user") && method === "GET") {
      console.debug("[DEMO] intercept auth user");
      return jsonResponse({ id: DEMO_USER_ID, email: DEMO_EMAIL }, 200);
    }

    // Intercept REST v1 table reads
    if (method === "GET" && isRestV1(urlObj)) {
      const table = tableFromRest(urlObj);

      // map unknown table names if your app uses different ones
      const tableMap = {
        // common alternates:
        "service_items": "services",
        "service": "services",
        "vehicle_class": "vehicle_classes",
        "vehicleclasses": "vehicle_classes",
        "appointments": "bookings",
        "orders": "bookings"
      };
      const resolved = DEMO_DB[table] ? table : (tableMap[table] || table);

      if (DEMO_DB[resolved]) {
        const rows = applyPostgrestFilters(DEMO_DB[resolved], urlObj);

        // If client expects single object (pgrst.object accept)
        const accept = (init && init.headers && (init.headers["Accept"] || init.headers.get?.("Accept"))) || "";
        const wantsObject = String(accept).includes("application/vnd.pgrst.object+json");
        console.debug("[DEMO] intercept rest", table, "->", resolved, "rows:", rows.length);

        return jsonResponse(wantsObject ? (rows[0] || null) : rows, 200, {
          "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`
        });
      }
    }

    // Block writes to Supabase (optional but safe)
    if (SUPABASE_HOST_RE.test(urlObj.hostname) && method !== "GET") {
      console.debug("[DEMO] block write", method, urlObj.pathname);
      return jsonResponse({ ok: true, demo: true }, 200);
    }

    return realFetch(input, init);
  };

  // 4) Ultra-simple Settings click fallback (works even if app handlers never bound)
  document.addEventListener("click", (e) => {
    const el = e.target && e.target.closest ? e.target.closest("button,a,[role='button']") : null;
    if (!el) return;

    const txt = (el.textContent || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    const aria = ((el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "")).toLowerCase();

    const wantsServices = (txt.includes("service") || txt.includes("leistungen") || id.includes("service") || aria.includes("service") || aria.includes("leistungen"));
    const wantsBusiness = (txt.includes("business") || txt.includes("unternehmen") || id.includes("business") || aria.includes("business") || aria.includes("unternehmen"));

    if (!wantsServices && !wantsBusiness) return;

    // show any panel that looks like the subview
    const key = wantsServices ? "services" : "business";

    const panel =
      document.querySelector(`[data-settings-subview="${key}"]`) ||
      document.getElementById(`settings-${key}`) ||
      document.getElementById(`settings-subview-${key}`) ||
      document.querySelector(`.settings-subview--${key}`) ||
      document.querySelector(`#${key}-subview`) ||
      document.querySelector(`.${key}-subview`);

    const allPanels = Array.from(document.querySelectorAll(
      "[data-settings-subview], .settings-subview, .settings-view__subview, .subview"
    ));

    if (allPanels.length) allPanels.forEach(p => { p.classList.add("hidden"); p.style.display = "none"; });
    if (panel) { panel.classList.remove("hidden"); panel.style.display = ""; }
  }, true);

  // Demo marker
  window.addEventListener("DOMContentLoaded", () => {
    try {
      const tag = document.createElement("div");
      tag.textContent = "DEMO – Daten sind simuliert";
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
