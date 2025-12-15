// Public Booking (detailhq.de/<detailer_uuid>)
// Lädt Services + Fahrzeugklassen über Worker API und schreibt "requested" Booking.

const API_BASE = "https://api.detailhq.de"; // dein Worker Host

function $(id) { return document.getElementById(id); }

const bookingForm = $("booking-form");
const bookingError = $("booking-error");
const publicError = $("public-error");
const publicSuccess = $("public-success");

const bookingCarInput = $("booking-car");
const bookingVehicleClassSelect = $("booking-vehicle-class");
const bookingMainServiceSelect = $("booking-main-service");

const bookingSinglesToggle = $("booking-singles-toggle");
const bookingSinglesMenu = $("booking-singles-menu");
const bookingSinglesList = $("booking-singles-list");

const bookingDateInput = $("booking-date");
const bookingTimeInput = $("booking-time");

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
  // /<uuid> oder /book.html?u=<uuid>
  const path = (location.pathname || "/").replace(/^\/+|\/+$/g, "");
  if (path && path !== "book.html" && path !== "book") return path;

  const u = new URLSearchParams(location.search).get("u");
  return u || null;
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

function toggleSinglesDropdown() {
  bookingSinglesMenu.classList.toggle("open");
}
document.addEventListener("click", (e) => {
  const within = e.target.closest(".booking-singles-dropdown");
  if (!within) bookingSinglesMenu.classList.remove("open");
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

  try {
    // Provider Info optional (Name etc.) – wenn du das später willst, Route ist schon vorbereitet.
    // const provider = await apiGet(`/public/provider?user=${encodeURIComponent(detailerId)}`);

    vehicleClasses = await apiGet(`/public/vehicle-classes?user=${encodeURIComponent(detailerId)}`);
    services = await apiGet(`/public/services?user=${encodeURIComponent(detailerId)}`);

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

next1.addEventListener("click", () => {
  if (!safeText(bookingCarInput.value)) return;
  if (!bookingVehicleClassSelect.value) return;
  showStep(2);
});

back2.addEventListener("click", () => showStep(1));
next2.addEventListener("click", () => {
  if (!validateStep2()) return;
  showStep(3);
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
    items.push({ kind: "package", id: packageSvc.id, name: packageSvc.name, price_cents: packageSvc.base_price_cents || 0 });
  }

  singlesSvcs.forEach((s) => {
    durationMinutes += Number(s.duration_minutes || 0);
    totalPriceCents += Number(s.base_price_cents || 0);
    items.push({ kind: "single", id: s.id, name: s.name, price_cents: s.base_price_cents || 0 });
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

    status: "requested",
    payment_status: "unpaid",

    // legacy text fields in deiner Tabelle
    service_name: packageSvc ? packageSvc.name : (singlesSvcs[0]?.name || "Terminanfrage"),
    service_price: Math.round(totalPriceCents / 100),

    total_price: Math.round(totalPriceCents / 100),
    items: items,
  };

  try {
    await apiPost(`/public/booking/request`, payload);
    publicSuccess.style.display = "block";
    bookingForm.querySelector("#public-submit").disabled = true;
  } catch (err) {
    console.error(err);
    publicError.style.display = "block";
    publicError.textContent = "Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen.";
  }
});

init();
