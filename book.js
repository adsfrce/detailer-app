// Public Booking (detailhq.de/<detailer_uuid>)
// Lädt Services + Fahrzeugklassen über Worker API und schreibt "requested" Booking.

const API_BASE = "https://api.detailhq.de"; // dein Worker Host

function $(id) { return document.getElementById(id); }

const bookingForm = $("booking-form");
const bookingError = $("booking-error");
const publicError = $("public-error");
const publicSuccess = $("public-success");

function showSuccessScreen(summary) {
  // summary: { car, vehicleClassName, dateStr, timeStr, durationMinutes, totalPriceCents, packageName, singlesNames[] }
  const durH = Math.round((summary.durationMinutes || 0) / 6) / 10;

  publicSuccess.innerHTML = `
    <div class="success-card">
      <div class="success-title">Terminanfrage gesendet</div>
      <div class="success-meta">Du bekommst eine Rückmeldung vom Aufbereiter.</div>

      <div class="success-line"><strong>Fahrzeug:</strong> ${summary.car}</div>
      <div class="success-line"><strong>Fahrzeugklasse:</strong> ${summary.vehicleClassName || "—"}</div>
      <div class="success-line"><strong>Termin:</strong> ${summary.dateStr} · ${summary.timeStr}</div>
      <div class="success-line"><strong>Dauer:</strong> ${durH} Std.</div>
      <div class="success-line"><strong>Preis:</strong> ${euro(summary.totalPriceCents)}</div>

      <div class="success-line" style="margin-top:12px;">
        <strong>Leistungen:</strong><br>
        ${summary.packageName ? `Paket: ${summary.packageName}<br>` : ""}
        ${summary.singlesNames && summary.singlesNames.length ? `Einzelleistungen: ${summary.singlesNames.join(", ")}` : ""}
      </div>
    </div>
  `;

  publicSuccess.style.display = "block";
}

const bookingCarInput = $("booking-car");
const bookingVehicleClassSelect = $("booking-vehicle-class");
const bookingMainServiceSelect = $("booking-main-service");

const bookingSinglesToggle = $("booking-singles-toggle");
const bookingSinglesMenu = $("booking-singles-menu");
const bookingSinglesList = $("booking-singles-list");

const bookingDateInput = $("booking-date");
const bookingTimeInput = $("booking-time");

function pad2(n) { return String(n).padStart(2, "0"); }

function minutesFromHHMM(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function hhmmFromMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function fetchAvailability(detailerId, day) {
  const r = await fetch(`${API_BASE}/public/availability?user=${encodeURIComponent(detailerId)}&day=${encodeURIComponent(day)}`);
  if (!r.ok) throw new Error("availability_failed");
  return await r.json(); // { day, blocked: [{start_at,end_at,...}] }
}

async function rebuildTimeOptionsForDay(detailerId, day, durationMinutes) {
  const timeSelect = document.getElementById("booking-time");
  const hint = document.getElementById("booking-time-hint");
  if (!timeSelect) return;

  timeSelect.innerHTML = `<option value="">Bitte wählen</option>`;
  if (hint) hint.textContent = "Lädt verfügbare Zeiten...";

  const data = await fetchAvailability(detailerId, day);
  const blocked = (data.blocked || []).map(x => ({
    start: new Date(x.start_at),
    end: new Date(x.end_at),
  }));

  // Basis-Zeitraum (kannst du später aus Profil übernehmen)
  const DAY_START = 7 * 60;   // 07:00
  const DAY_END = 20 * 60;    // 20:00
  const STEP = 15;

  const dur = Math.max(15, Number(durationMinutes || 0)); // minimum 15
  const options = [];

  for (let t = DAY_START; t + dur <= DAY_END; t += STEP) {
    const start = new Date(`${day}T${hhmmFromMinutes(t)}:00`);
    const end = new Date(start.getTime() + dur * 60000);

    const isBlocked = blocked.some(b => overlaps(start, end, b.start, b.end));
    if (!isBlocked) options.push(hhmmFromMinutes(t));
  }

  for (const hhmm of options) {
    const opt = document.createElement("option");
    opt.value = hhmm;
    opt.textContent = hhmm;
    timeSelect.appendChild(opt);
  }

  if (hint) hint.textContent = options.length ? "" : "Keine freien Zeiten an diesem Tag.";
}

const bookingCustomerNameInput = $("booking-customer-name");
const bookingCustomerEmailInput = $("booking-customer-email");
const bookingCustomerPhoneInput = $("booking-customer-phone");
const bookingCustomerAddressInput = $("booking-customer-address");
const bookingNotesInput = $("booking-notes");

const next1 = $("booking-next-1");
const next2 = $("booking-next-2");
const next3 = $("booking-next-3");
const back2 = $("booking-back-2");
const back3 = $("booking-back-3");

const step1 = $("booking-step-1");
const step2 = $("booking-step-2");
const step3 = $("booking-step-3");
const step4 = $("booking-step-4");

const ind1 = $("booking-step-indicator-1");
const ind2 = $("booking-step-indicator-2");
const ind3 = $("booking-step-indicator-3");
const ind4 = $("booking-step-indicator-4");

let detailerId = null;
let vehicleClasses = [];
let services = [];
let selectedSingles = new Set();

function getCurrentDurationMinutes() {
  let dur = 0;

  const packageId = bookingMainServiceSelect.value || null;
  const packageSvc = packageId ? services.find(s => String(s.id) === String(packageId)) : null;
  if (packageSvc) dur += Number(packageSvc.duration_minutes || 0) || 0;

  for (const sid of selectedSingles) {
    const svc = services.find(s => String(s.id) === String(sid));
    if (svc) dur += Number(svc.duration_minutes || 0) || 0;
  }

  return Math.max(15, dur || 0);
}

function setIndicator(step) {
  [ind1, ind2, ind3, ind4].forEach((el, i) => el.classList.toggle("active", i === (step - 1)));
}

function showStep(step) {
  step1.classList.toggle("hidden", step !== 1);
  step2.classList.toggle("hidden", step !== 2);
  step3.classList.toggle("hidden", step !== 3);
  step4.classList.toggle("hidden", step !== 4);
  setIndicator(step);
  bookingError.textContent = "";
}

function getPathDetailerId() {
  // Unterstützt:
  // - /<uuid>
  // - /book/<uuid>
  // - /book.html?u=<uuid>
  // - /book.html?detailer=<uuid>

  const rawPath = (location.pathname || "/").replace(/^\/+|\/+$/g, "");
  const parts = rawPath ? rawPath.split("/") : [];

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = (parts[i] || "").trim();
    if (uuidRe.test(seg)) return seg;
  }

  // Fallback: wenn jemand direkt /<uuid> ohne weitere Segmente hat, aber nicht als UUID erkannt (sollte nicht passieren)
  if (rawPath && rawPath !== "book.html" && rawPath !== "book") return rawPath;

const params = new URLSearchParams(window.location.search);
const u = params.get("u");
const d = params.get("detailer");
const user = params.get("user");
return u || d || user || null;

  return null;
}

function euro(cents) {
  const v = (Number(cents || 0) / 100);
  return v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function safeText(s) {
  return (s || "").toString().trim();
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: "GET" });
  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status}`);
  return await res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`API POST ${path} failed: ${res.status} ${t}`);
  }
  return await res.json().catch(() => ({}));
}

function renderVehicleClasses() {
  bookingVehicleClassSelect.innerHTML = `<option value="">Bitte wählen</option>`;
  vehicleClasses.forEach((vc) => {
    const opt = document.createElement("option");
    opt.value = vc.id; // vehicle_classes.id
    opt.textContent = vc.name;
    bookingVehicleClassSelect.appendChild(opt);
  });
}

function renderPackages() {
  bookingMainServiceSelect.innerHTML = `<option value="">Kein Paket</option>`;
  services.filter(s => s.kind === "package" && (s.is_active !== false))
    .forEach((svc) => {
      const opt = document.createElement("option");
      opt.value = svc.id;
      opt.textContent = `${svc.name} · ${euro(svc.base_price_cents)} · ${Math.round((svc.duration_minutes||0)/6)/10} Std.`;
      bookingMainServiceSelect.appendChild(opt);
    });
}

function renderSinglesMenu() {
  bookingSinglesMenu.innerHTML = "";
  const singles = services.filter(s => s.kind === "single" && (s.is_active !== false));

  if (singles.length === 0) {
    const p = document.createElement("p");
    p.className = "form-hint";
    p.textContent = "Keine Einzelleistungen verfügbar.";
    bookingSinglesMenu.appendChild(p);
    return;
  }

  singles.forEach((svc) => {
    const row = document.createElement("label");
    row.className = "settings-dropdown-item";
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.alignItems = "center";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedSingles.has(svc.id);

    cb.addEventListener("change", () => {
      if (cb.checked) selectedSingles.add(svc.id);
      else selectedSingles.delete(svc.id);
      renderSelectedSinglesList();
    });

    const txt = document.createElement("div");
    txt.style.flex = "1";
    txt.textContent = `${svc.name} · ${euro(svc.base_price_cents)}`;

    row.appendChild(cb);
    row.appendChild(txt);
    bookingSinglesMenu.appendChild(row);
  });

  renderSelectedSinglesList();
}

function renderSelectedSinglesList() {
  const singles = services.filter(s => selectedSingles.has(s.id));
  if (singles.length === 0) {
    bookingSinglesList.textContent = "Keine Einzelleistungen gewählt.";
    return;
  }
  bookingSinglesList.textContent = singles.map(s => s.name).join(", ");
}

const bookingSinglesDropdown = document.querySelector(".booking-singles-dropdown");

function toggleSinglesDropdown() {
  if (!bookingSinglesDropdown) return;
  bookingSinglesDropdown.classList.toggle("open");
}

document.addEventListener("click", (e) => {
  if (!bookingSinglesDropdown) return;
  const within = e.target.closest(".booking-singles-dropdown");
  if (!within) bookingSinglesDropdown.classList.remove("open");
});

bookingSinglesToggle.addEventListener("click", (e) => {
  e.preventDefault();
  toggleSinglesDropdown();
});

function validateStep2() {
  const packageId = bookingMainServiceSelect.value || "";
  const singlesCount = selectedSingles.size;
  if (!packageId && singlesCount === 0) {
    bookingError.textContent = "Bitte mindestens ein Paket oder eine Einzelleistung auswählen.";
    return false;
  }
  return true;
}

async function init() {
  detailerId = getPathDetailerId();
  if (!detailerId) {
    publicError.style.display = "block";
    publicError.textContent = "Ungültiger Link.";
    showStep(1);
    return;
  }

  publicError.style.display = "none";
  publicError.textContent = "";

  try {
    // Provider Info optional (Name etc.) – wenn du das später willst, Route ist schon vorbereitet.
    // const provider = await apiGet(`/public/provider?user=${encodeURIComponent(detailerId)}`);

    const vcRes = await apiGet(`/public/vehicle-classes?detailer=${encodeURIComponent(detailerId)}`);
    vehicleClasses = Array.isArray(vcRes) ? vcRes : (vcRes.vehicle_classes || []);

    const sRes = await apiGet(`/public/services?detailer=${encodeURIComponent(detailerId)}`);
    services = Array.isArray(sRes) ? sRes : (sRes.services || []);

    renderVehicleClasses();
    renderPackages();
    renderSinglesMenu();

    showStep(1);
  } catch (err) {
    publicError.style.display = "block";
    publicError.textContent = "Konnte Daten nicht laden. Bitte später erneut versuchen.";
    console.error(err);
  }
}

bookingDateInput.addEventListener("change", async () => {
  if (!detailerId) return;
  if (!bookingDateInput.value) return;

  try {
    await rebuildTimeOptionsForDay(detailerId, bookingDateInput.value, getCurrentDurationMinutes());
  } catch (e) {
    console.error(e);
  }
});

next1.addEventListener("click", () => {
  if (!safeText(bookingCarInput.value)) return;
  if (!bookingVehicleClassSelect.value) return;
  showStep(2);
});

back2.addEventListener("click", () => showStep(1));
next2.addEventListener("click", async () => {
  if (!validateStep2()) return;
  showStep(3);

  if (!detailerId) return;
  if (!bookingDateInput.value) return;

  try {
    await rebuildTimeOptionsForDay(detailerId, bookingDateInput.value, getCurrentDurationMinutes());
  } catch (e) {
    console.error(e);
  }
});

back3.addEventListener("click", () => showStep(2));
next3.addEventListener("click", () => {
  if (!bookingDateInput.value || !bookingTimeInput.value) return;
  showStep(4);
});

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  bookingError.textContent = "";
  publicError.style.display = "none";
  publicSuccess.style.display = "none";

  const car = safeText(bookingCarInput.value);
  const vehicleClassId = bookingVehicleClassSelect.value;
  const vehicleClassName = (vehicleClasses.find(v => String(v.id) === String(vehicleClassId)) || {}).name || "";

  const packageId = bookingMainServiceSelect.value || null;
  const packageSvc = packageId ? services.find(s => String(s.id) === String(packageId)) : null;

  const singles = Array.from(selectedSingles);
  const singlesSvcs = services.filter(s => singles.includes(s.id));

  if (!car || !vehicleClassId) {
    bookingError.textContent = "Bitte Fahrzeug und Fahrzeugklasse ausfüllen.";
    showStep(1);
    return;
  }
  if (!packageId && singles.length === 0) {
    bookingError.textContent = "Bitte mindestens ein Paket oder eine Einzelleistung auswählen.";
    showStep(2);
    return;
  }
  if (!bookingDateInput.value || !bookingTimeInput.value) {
    bookingError.textContent = "Bitte Datum und Uhrzeit wählen.";
    showStep(3);
    return;
  }

  const customerName = safeText(bookingCustomerNameInput.value);
  const customerEmail = safeText(bookingCustomerEmailInput.value);
  const customerPhone = safeText(bookingCustomerPhoneInput.value);
  const customerAddress = safeText(bookingCustomerAddressInput.value);
  const notes = safeText(bookingNotesInput.value);

  if (!customerName || !customerEmail || !customerPhone) {
    bookingError.textContent = "Bitte Name, Telefon und E-Mail ausfüllen.";
    return;
  }

  const startAt = new Date(`${bookingDateInput.value}T${bookingTimeInput.value}:00`);
  if (isNaN(startAt.getTime())) {
    bookingError.textContent = "Ungültiger Termin.";
    return;
  }

  // duration + price (nur aus Services, keine Vehicle-Class-Delta hier; kann man später addieren)
  let durationMinutes = 0;
  let totalPriceCents = 0;

  const items = [];

  if (packageSvc) {
    durationMinutes += Number(packageSvc.duration_minutes || 0);
    totalPriceCents += Number(packageSvc.base_price_cents || 0);
items.push({ role: "package", kind: "package", id: packageSvc.id, name: packageSvc.name, price_cents: packageSvc.base_price_cents || 0 });
  }

  singlesSvcs.forEach((s) => {
    durationMinutes += Number(s.duration_minutes || 0);
    totalPriceCents += Number(s.base_price_cents || 0);
items.push({ role: "single", kind: "single", id: s.id, name: s.name, price_cents: s.base_price_cents || 0 });
  });

  const payload = {
    detailer_id: detailerId,

    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    customer_address: customerAddress || null,

    car: car,
    notes: notes || null,

    vehicle_class_id: vehicleClassId,
    vehicle_class_name: vehicleClassName || null,

    start_at: startAt.toISOString(),
    duration_minutes: durationMinutes,

    // Kompatibilität: Tabelle hat "status", App nutzt teils "job_status"
    status: "planned",
    job_status: "planned",

    // App-Logik nutzt open/paid/partial (nicht "unpaid")
    payment_status: "open",

    // legacy fields (optional, aber bei dir existieren sie)
    service_name: packageSvc ? packageSvc.name : (singlesSvcs[0]?.name || "Auftrag"),
    service_price: (totalPriceCents / 100),

    total_price: (totalPriceCents / 100),

    // Items im selben Format wie deine App (service_id statt id)
    items: items.map((it) => ({
      role: it.role,
      service_id: it.id,
      name: it.name,
      price_cents: it.price_cents,
    })),
  };

  try {
    await apiPost(`/public/booking/request`, payload);

    const dateStr = new Date(payload.start_at).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    showSuccessScreen({
      car,
      vehicleClassName,
      dateStr,
      timeStr: bookingTimeInput.value,
      durationMinutes,
      totalPriceCents,
      packageName: packageSvc ? packageSvc.name : "",
      singlesNames: singlesSvcs.map(s => s.name),
    });

    const submitBtn = bookingForm.querySelector("#public-submit");
    if (submitBtn) submitBtn.disabled = true;
  } catch (err) {
    console.error(err);
    publicError.style.display = "block";
    publicError.textContent = "Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen.";
  }
});

init();



