// ================================
// Supabase Setup
// ================================
const SUPABASE_URL = "https://qcilpodwbtbsxoabjfzc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaWxwb2R3YnRic3hvYWJqZnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzNTQsImV4cCI6MjA4MDg0NjM1NH0.RZ4M0bMSVhNpYZnktEyKCuJDFEpSJoyCmLFQhQLXs_w";

let supabaseClient = null;

try {
  // global "supabase" kommt aus dem UMD-Script im <head>
  console.log("DetailHQ: Supabase global typeof =", typeof supabase);
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("DetailHQ: Supabase Client initialisiert");
} catch (err) {
  console.error("DetailHQ: Supabase initialisation FAILED:", err);
}

// Theme Key muss VOR init bekannt sein
const THEME_KEY = "detailhq_theme";

// ================================
// GLOBAL STATE
// ================================
let currentUser = null;
let currentProfile = null;
let currentCalendarUrl = "";
let vehicleClasses = [];
let services = [];

// ================================
// DOM REFERENZEN
// ================================
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");

// Auth
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authError = document.getElementById("auth-error");
const registerSwitch = document.getElementById("register-switch");
const loginSwitch = document.getElementById("login-switch");
const passwordResetButton = document.getElementById("password-reset-button");

// Navigation / Tabs
const navItems = document.querySelectorAll(".nav-item");
const tabSections = document.querySelectorAll(".tab-section");
const headerTitle = document.getElementById("header-title");
const headerSubtitle = document.getElementById("header-subtitle");

// Profil / Menü
const profileButton = document.getElementById("profile-button");
const profileMenu = document.getElementById("profile-menu");
const profileManageButton = document.getElementById("profile-manage-button");
const profileLogoutButton = document.getElementById("profile-logout-button");

// Avatar – wir gehen von <img id="profile-avatar-image" ...> aus
const profileAvatarImage = document.getElementById("profile-avatar-image");

// Trial-Banner
const trialBanner = document.getElementById("trial-banner");
const trialBannerText = document.getElementById("trial-banner-text");
const trialBannerButton = document.getElementById("trial-banner-button");

// Profil-Modal
const profileModal = document.getElementById("profile-modal");
const profileCloseButton = document.getElementById("profile-close-button");
const profileForm = document.getElementById("profile-form");
const profileNameInput = document.getElementById("profile-name");
const profileCompanyInput = document.getElementById("profile-company");
const profileAddressInput = document.getElementById("profile-address");
const profileAvatarFile = document.getElementById("profile-avatar-file");
const profileSaveMessage = document.getElementById("profile-save-message");

// Theme
const themeRadioInputs = document.querySelectorAll('input[name="theme"]');

// Kalender
const calendarPreferenceInputs = document.querySelectorAll(
  'input[name="calendar-preference"]'
);
const calendarOpenButton = document.getElementById("calendar-open-button");

// Billing
const billingManageButton = document.getElementById("billing-manage-plan-button");
const billingLifetimeButton = document.getElementById("billing-switch-lifetime-button");
const billingYearlyButton = document.getElementById("billing-subscription-yearly-button");
const billingMonthlyButton = document.getElementById("billing-subscription-monthly-button"); // <-- NEU

// Bewertungen
const settingsReviewLinkInput = document.getElementById("settings-review-link");
const settingsReviewSaveButton = document.getElementById("settings-review-save-button");
const settingsReviewSaveStatus = document.getElementById("settings-review-save-status");

// Services / Vehicle Classes
const vehicleClassesList = document.getElementById("vehicle-classes-list");
const vehicleClassAddButton = document.getElementById("vehicle-class-add-button");
const vehicleClassModal = document.getElementById("vehicle-class-modal");
const vehicleClassModalTitle = document.getElementById("vehicle-class-modal-title");
const vehicleClassModalClose = document.getElementById("vehicle-class-modal-close");
const vehicleClassForm = document.getElementById("vehicle-class-form");
const vehicleClassNameInput = document.getElementById("vehicle-class-name");
const vehicleClassPriceFactorInput = document.getElementById("vehicle-class-price-factor");
const vehicleClassDurationFactorInput = document.getElementById("vehicle-class-duration-factor");
const vehicleClassModalError = document.getElementById("vehicle-class-modal-error");

const servicesList = document.getElementById("services-list");
const serviceAddButton = document.getElementById("service-add-button");
const serviceModal = document.getElementById("service-modal");
const serviceModalTitle = document.getElementById("service-modal-title");
const serviceModalClose = document.getElementById("service-modal-close");
const serviceForm = document.getElementById("service-form");
const serviceKindInput = document.getElementById("service-kind");
const serviceCategoryInput = document.getElementById("service-category");
const serviceNameInput = document.getElementById("service-name");
const servicePriceInput = document.getElementById("service-price");
const serviceDurationInput = document.getElementById("service-duration");
const serviceDescriptionInput = document.getElementById("service-description");
const serviceModalError = document.getElementById("service-modal-error");

// Booking modal / New order
const newBookingButton = document.getElementById("new-booking-button");
const newBookingButton2 = document.getElementById("new-booking-button-2");
const bookingModal = document.getElementById("booking-modal");
const bookingCloseButton = document.getElementById("booking-close-button");
const bookingForm = document.getElementById("booking-form");
const bookingVehicleClassSelect = document.getElementById("booking-vehicle-class");
const bookingCarInput = document.getElementById("booking-car");
const bookingMainServiceSelect = document.getElementById("booking-main-service");
const bookingSinglesList = document.getElementById("booking-singles-list");
const bookingAddonsList = document.getElementById("booking-addons-list");
const bookingDateInput = document.getElementById("booking-date");
const bookingTimeInput = document.getElementById("booking-time");
const bookingCustomerNameInput = document.getElementById("booking-customer-name");
const bookingCustomerEmailInput = document.getElementById("booking-customer-email");
const bookingCustomerPhoneInput = document.getElementById("booking-customer-phone");
const bookingCustomerAddressInput = document.getElementById("booking-customer-address");
const bookingNotesInput = document.getElementById("booking-notes");
const bookingJobStatusSelect = document.getElementById("booking-job-status");
const bookingPaymentStatusSelect = document.getElementById("booking-payment-status");
const bookingSummaryPrice = document.getElementById("booking-summary-price");
const bookingSummaryDuration = document.getElementById("booking-summary-duration");
const bookingError = document.getElementById("booking-error");

// ================================
// INIT – direkt ausführen (kein DOMContentLoaded-Problem)
// ================================
(async function init() {
  console.log("DetailHQ init startet...");

  if (!supabaseClient) {
    console.error("DetailHQ: Kein Supabase-Client – Auth funktioniert nicht.");
    showAuthView();
    return;
  }

  initThemeFromStorage();
  setupAuthHandlers();
  setupNavHandlers();
  setupThemeHandlers();
  setupProfileMenuHandlers();
  setupBillingHandlers();
  setupCalendarHandlers();
  setupTrialBannerHandlers();
  setupReviewSettingsHandlers();
  setupServiceManagementHandlers();
  setupBookingHandlers();

  function setupReviewSettingsHandlers() {
    if (!settingsReviewSaveButton || !settingsReviewLinkInput) return;

    settingsReviewSaveButton.addEventListener("click", async () => {
      if (!currentUser) {
        if (settingsReviewSaveStatus) {
          settingsReviewSaveStatus.textContent = "Bitte zuerst anmelden.";
        }
        return;
      }

      const link = settingsReviewLinkInput.value.trim();

      if (settingsReviewSaveStatus) {
        settingsReviewSaveStatus.textContent = "Speichern...";
      }

      const { error } = await supabaseClient
        .from("profiles")
        .update({ review_link: link || null })
        .eq("id", currentUser.id);

      if (error) {
        console.error("DetailHQ: review_link speichern fehlgeschlagen:", error);
        if (settingsReviewSaveStatus) {
          settingsReviewSaveStatus.textContent =
            "Fehler beim Speichern. Bitte später erneut versuchen.";
        }
        return;
      }

      // lokalen State updaten
      if (currentProfile) {
        currentProfile.review_link = link || null;
      }

      if (settingsReviewSaveStatus) {
        settingsReviewSaveStatus.textContent = "Gespeichert.";
        setTimeout(() => {
          settingsReviewSaveStatus.textContent = "";
        }, 2000);
      }
    });
  }

  console.log("DetailHQ: Setup-Funktionen ausgeführt, hole aktuellen User...");

  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error("DetailHQ: Fehler bei getUser:", error);
  }

  const user = data?.user || null;

  if (user) {
    console.log("DetailHQ: Benutzer bereits eingeloggt:", user.id);
    currentUser = user;

    await ensureProfile();
    await loadProfileIntoForm();
    setupCalendarUrlForUser();

    // NEU: Fahrzeugklassen & Services laden
    await loadVehicleClasses();
    await loadServices();

    showAppView();
  } else {
    console.log("DetailHQ: Kein aktiver User -> Login anzeigen");
    showAuthView();
  }
})();

// ================================
// VIEW SWITCHING
// ================================
function showAuthView() {
  console.log("DetailHQ: showAuthView");
  if (authView) authView.classList.add("active");
  if (appView) appView.classList.remove("active");
}

function showAppView() {
  console.log("DetailHQ: showAppView");
  if (authView) authView.classList.remove("active");
  if (appView) appView.classList.add("active");
}

// ================================
// AUTH HANDLER
// ================================
function setupAuthHandlers() {
  console.log("DetailHQ: setupAuthHandlers");

  if (registerSwitch && loginForm && registerForm) {
    registerSwitch.addEventListener("click", () => {
      console.log("DetailHQ: Switch -> Register");
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
      if (authError) authError.textContent = "";
    });
  }

  if (loginSwitch && loginForm && registerForm) {
    loginSwitch.addEventListener("click", () => {
      console.log("DetailHQ: Switch -> Login");
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
      if (authError) authError.textContent = "";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (authError) authError.textContent = "";
      console.log("DetailHQ: Login submit");

      const emailEl = document.getElementById("login-email");
      const pwEl = document.getElementById("login-password");
      const email = emailEl ? emailEl.value.trim() : "";
      const password = pwEl ? pwEl.value.trim() : "";

      if (!email || !password) {
        if (authError)
          authError.textContent = "Bitte E-Mail und Passwort eingeben.";
        return;
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("DetailHQ: Login-Fehler:", error);
        if (authError)
          authError.textContent =
            error.message || "Anmeldung fehlgeschlagen.";
        return;
      }

currentUser = data.user;
await ensureProfile();
await loadProfileIntoForm();
setupCalendarUrlForUser();
await loadVehicleClasses();
await loadServices();
showAppView();
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (authError) authError.textContent = "";
      console.log("DetailHQ: Register submit");

      const emailEl = document.getElementById("register-email");
      const pwEl = document.getElementById("register-password");
      const email = emailEl ? emailEl.value.trim() : "";
      const password = pwEl ? pwEl.value.trim() : "";

      if (!email || !password) {
        if (authError)
          authError.textContent =
            "Bitte E-Mail und Passwort eingeben.";
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error("DetailHQ: Register-Fehler:", error);
        if (authError)
          authError.textContent =
            error.message || "Registrierung fehlgeschlagen.";
        return;
      }

      const { data: signInData, error: signInError } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        console.error("DetailHQ: Auto-Login nach Register fehlgeschlagen:", signInError);
        if (authError)
          authError.textContent =
            signInError.message || "Automatische Anmeldung fehlgeschlagen.";
        return;
      }

currentUser = signInData.user;
await ensureProfile();
await loadProfileIntoForm();
setupCalendarUrlForUser();
await loadVehicleClasses();
await loadServices();
showAppView();
    });
  }

  if (passwordResetButton) {
    passwordResetButton.addEventListener("click", async () => {
      if (authError) authError.textContent = "";

      const emailInput = document.getElementById("login-email");
      const email = emailInput ? emailInput.value.trim() : "";

      if (!email) {
        if (authError) {
          authError.textContent =
            'Bitte gib oben deine E-Mail ein und klicke dann auf "Passwort vergessen?".';
        }
        return;
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: "https://detailhq.de",
      });

      if (error) {
        console.error("Passwort-Reset Fehler:", error);
        if (authError) {
          authError.textContent =
            error.message || "Zurücksetzen des Passworts fehlgeschlagen.";
        }
        return;
      }

      if (authError) {
        authError.textContent =
          "Wenn die E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet.";
      }
    });
  }
}

// ================================
// NAVIGATION / TABS
// ================================
function setupNavHandlers() {
  console.log("DetailHQ: setupNavHandlers");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      switchTab(tab);
    });
  });
}

function switchTab(tabName) {
  navItems.forEach((item) => {
    const t = item.getAttribute("data-tab");
    item.classList.toggle("active", t === tabName);
  });

  tabSections.forEach((section) => {
    section.classList.toggle(
      "active",
      section.id === `tab-${tabName}`
    );
  });

  if (tabName === "dashboard") {
    headerTitle.textContent = "Dashboard";
    headerSubtitle.textContent =
      "Übersicht über deine Aufträge und Umsätze.";
  } else if (tabName === "schedule") {
    headerTitle.textContent = "Zeitplan";
    headerSubtitle.textContent =
      "Alle geplanten Aufträge im Blick.";
  } else if (tabName === "settings") {
    headerTitle.textContent = "Einstellungen";
    headerSubtitle.textContent =
      "Darstellung, Dienste, Zahlung & Support.";
  }
}

// ================================
// THEME
// ================================
function initThemeFromStorage() {
  // Standard soll "system" sein
  const stored = localStorage.getItem(THEME_KEY) || "system";
  applyTheme(stored);

  themeRadioInputs.forEach((input) => {
    input.checked = input.value === stored;
  });
}

function setupThemeHandlers() {
  themeRadioInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        const value = input.value;
        localStorage.setItem(THEME_KEY, value);
        applyTheme(value);
      }
    });
  });
}

function applyTheme(theme) {
  document.body.classList.remove("theme-light", "theme-dark", "theme-system");

  if (theme === "light") {
    document.body.classList.add("theme-light");
  } else if (theme === "dark") {
    document.body.classList.add("theme-dark");
  } else {
    document.body.classList.add("theme-system");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    document.body.classList.add(prefersDark ? "theme-dark" : "theme-light");
  }
}

// ================================
// PROFILE / PROFILES TABLE
// ================================
async function ensureProfile() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("DetailHQ: Fehler beim Laden des Profils:", error);
    return;
  }

  if (!data) {
    const themeSetting = localStorage.getItem(THEME_KEY) || "system";
    const { error: insertError } = await supabaseClient
      .from("profiles")
      .insert({
        id: currentUser.id,
        appearance: themeSetting,
        // plan_status & trial_ends_at kommen über DB-Defaults
      });
    if (insertError) {
      console.error("DetailHQ: Fehler beim Anlegen des Profils:", insertError);
    }
  }
}

async function loadProfileIntoForm() {
  if (!currentUser || !profileForm) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error("DetailHQ: Fehler beim Laden des Profils:", error);
    return;
  }

  currentProfile = data;

  if (profileNameInput) profileNameInput.value = data.full_name || "";
  if (profileCompanyInput)
    profileCompanyInput.value = data.company_name || "";
  if (profileAddressInput)
    profileAddressInput.value = data.address || "";

  if (settingsReviewLinkInput) {
    settingsReviewLinkInput.value = data.review_link || "";
  }

  const pref = data.calendar_preference || "apple";
  calendarPreferenceInputs.forEach((inp) => {
    inp.checked = inp.value === pref;
  });

  updateAvatarVisual(data.avatar_url);
  updateBillingUI();
  updateTrialBanner();
}

// Avatar: Default pfp.png, sonst URL
function updateAvatarVisual(avatarUrl) {
  if (!profileAvatarImage) return;
  console.log("DetailHQ: updateAvatarVisual", avatarUrl);
  if (avatarUrl) {
    profileAvatarImage.src = avatarUrl;
  } else {
    profileAvatarImage.src = "pfp.png";
  }
}

// ================================
// PROFILE-MODAL / MENÜ
// ================================
function setupProfileMenuHandlers() {
  console.log("DetailHQ: setupProfileMenuHandlers");

  if (profileButton && profileMenu) {
    profileButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = profileMenu.classList.contains("hidden");
      if (isHidden) {
        showProfileMenu();
      } else {
        hideProfileMenu();
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!profileMenu || !profileButton) return;
    if (
      !profileMenu.contains(e.target) &&
      !profileButton.contains(e.target)
    ) {
      hideProfileMenu();
    }
  });

  if (profileManageButton) {
    profileManageButton.addEventListener("click", () => {
      hideProfileMenu();
      openProfileModal();
    });
  }

  if (profileCloseButton) {
    profileCloseButton.addEventListener("click", () => {
      closeProfileModal();
    });
  }

  if (profileModal) {
    profileModal.addEventListener("click", (e) => {
      if (
        e.target === profileModal ||
        e.target.classList.contains("profile-modal-backdrop")
      ) {
        closeProfileModal();
      }
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      if (profileSaveMessage) profileSaveMessage.textContent = "";

      const full_name = profileNameInput?.value.trim() || "";
      const company_name = profileCompanyInput?.value.trim() || "";
      const address = profileAddressInput?.value.trim() || "";

      const calendar_preference = (() => {
        let v = "apple";
        calendarPreferenceInputs.forEach((inp) => {
          if (inp.checked) v = inp.value;
        });
        return v;
      })();

      const review_link = settingsReviewLinkInput
        ? settingsReviewLinkInput.value.trim()
        : currentProfile?.review_link || null;

      let avatar_url = currentProfile?.avatar_url || null;

      // Profilbild hochladen, falls gewählt
      if (profileAvatarFile && profileAvatarFile.files.length > 0) {
        const file = profileAvatarFile.files[0];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${currentUser.id}/${Date.now()}.${ext}`;

        console.log("DetailHQ: Avatar-Upload startet, Pfad:", path);

        const { error: uploadError } = await supabaseClient.storage
          .from("avatars")
          .upload(path, file, {
            upsert: true,
          });

        if (uploadError) {
          console.error("DetailHQ: Avatar Upload fehlgeschlagen:", uploadError);
          if (profileSaveMessage) {
            profileSaveMessage.textContent =
              "Profilbild-Upload fehlgeschlagen, Rest wird gespeichert.";
          }
        } else {
          const {
            data: { publicUrl },
          } = supabaseClient.storage
            .from("avatars")
            .getPublicUrl(path);

          console.log("DetailHQ: Avatar public URL:", publicUrl);
          avatar_url = publicUrl || avatar_url;
        }
      }

      const { error } = await supabaseClient
        .from("profiles")
        .update({
          full_name,
          company_name,
          address,
          avatar_url,
          calendar_preference,
          review_link,
        })
        .eq("id", currentUser.id);

      if (error) {
        console.error("DetailHQ: Profil speichern fehlgeschlagen:", error);
        if (profileSaveMessage) {
          profileSaveMessage.textContent =
            "Fehler beim Speichern. Bitte später erneut versuchen.";
        }
        return;
      }

      currentProfile = {
        ...(currentProfile || {}),
        full_name,
        company_name,
        address,
        avatar_url,
        calendar_preference,
        review_link,
      };

      updateAvatarVisual(avatar_url);
      updateBillingUI();
      updateTrialBanner();

      if (profileSaveMessage) profileSaveMessage.textContent = "Gespeichert.";
      setTimeout(() => {
        if (profileSaveMessage) profileSaveMessage.textContent = "";
        closeProfileModal();
      }, 1000);
    });
  }
}

function showProfileMenu() {
  if (!profileMenu) return;
  profileMenu.classList.remove("hidden");
}

function hideProfileMenu() {
  if (!profileMenu) return;
  profileMenu.classList.add("hidden");
}

function openProfileModal() {
  if (!profileModal) return;
  profileModal.classList.remove("hidden");
}

function closeProfileModal() {
  if (!profileModal) return;
  profileModal.classList.add("hidden");
}

// ================================
// BILLING (Stripe)
// ================================
function setupBillingHandlers() {
  const apiBase = "https://api.detailhq.de";

  if (billingManageButton) {
    billingManageButton.addEventListener("click", () => {
      if (!currentUser) return;
      const url = `${apiBase}/billing/portal?user=${encodeURIComponent(
        currentUser.id
      )}`;
      window.location.href = url;
    });
  }

  if (billingLifetimeButton) {
    billingLifetimeButton.addEventListener("click", () => {
      if (!currentUser) return;
      const url = `${apiBase}/billing/lifetime?user=${encodeURIComponent(
        currentUser.id
      )}`;
      window.location.href = url;
    });
  }

  if (billingYearlyButton) {
    billingYearlyButton.addEventListener("click", () => {
      if (!currentUser) return;
      const url = `${apiBase}/billing/subscription-yearly?user=${encodeURIComponent(
        currentUser.id
      )}`;
      window.location.href = url;
    });
  }

  if (billingMonthlyButton) { // <-- NEU
    billingMonthlyButton.addEventListener("click", () => {
      if (!currentUser) return;
      const url = `${apiBase}/billing/subscription?user=${encodeURIComponent(
        currentUser.id
      )}`;
      window.location.href = url;
    });
  }
}

function updateBillingUI() {
  if (!currentProfile) return;

  const isLifetime = !!currentProfile.is_lifetime;
  const status = currentProfile.plan_status || null;

  // Lifetime-Button: weg, wenn schon Lifetime
  if (billingLifetimeButton) {
    billingLifetimeButton.style.display = isLifetime ? "none" : "inline-flex";
  }

  // Monatsabo-Button:
  // - weg, wenn Lifetime
  // - weg, wenn plan_status === "active" (aktives Monatsabo)
  if (billingMonthlyButton) {
    if (isLifetime || status === "active") {
      billingMonthlyButton.style.display = "none";
    } else {
      billingMonthlyButton.style.display = "inline-flex";
    }
  }

  // Jahresabo-Button:
  // - weg, wenn Lifetime
  // - weg, wenn plan_status === "active_yearly"
  if (billingYearlyButton) {
    if (isLifetime || status === "active_yearly") {
      billingYearlyButton.style.display = "none";
    } else {
      billingYearlyButton.style.display = "inline-flex";
    }
  }
}

function updateTrialBanner() {
  if (!trialBanner || !currentProfile) return;

  const status = currentProfile.plan_status || "trial";
  const endsAt = currentProfile.trial_ends_at
    ? new Date(currentProfile.trial_ends_at)
    : null;

  if (status !== "trial" || !endsAt) {
    trialBanner.classList.add("hidden");
    return;
  }

  const now = new Date();
  const diffMs = endsAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let msg;
  if (diffDays > 1) {
    msg = `Deine Testphase läuft in ${diffDays} Tagen ab.`;
  } else if (diffDays === 1) {
    msg = `Deine Testphase läuft morgen ab.`;
  } else if (diffDays === 0) {
    msg = `Deine Testphase läuft heute ab.`;
  } else {
    msg = `Deine Testphase ist abgelaufen.`;
  }

  trialBannerText.textContent = msg;
  trialBanner.classList.remove("hidden");
}

// Trial-Banner Button -> wechselt nur in Einstellungen-Tab
function setupTrialBannerHandlers() {
  if (!trialBannerButton) return;

  trialBannerButton.addEventListener("click", () => {
    // nur UI-Tab wechseln, kein Stripe-Call
    switchTab("settings");
  });
}

// ================================
// KALENDER
// ================================
function setupCalendarHandlers() {
  console.log("DetailHQ: setupCalendarHandlers");
  if (calendarOpenButton) {
    calendarOpenButton.addEventListener("click", () => {
      if (!currentCalendarUrl || !currentUser) return;

      let pref = "apple";
      calendarPreferenceInputs.forEach((inp) => {
        if (inp.checked) pref = inp.value;
      });

      if (pref === "apple") {
        const webcalUrl = currentCalendarUrl.replace(/^https?:/, "webcal:");
        window.location.href = webcalUrl;
      } else {
        const googleUrl = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(
          currentCalendarUrl
        )}`;
        window.location.href = googleUrl;
      }
    });
  }
}

// ================================
// SERVICES & VEHICLE CLASSES
// ================================
async function loadVehicleClasses() {
  if (!currentUser || !supabaseClient || !vehicleClassesList) return;

  const { data, error } = await supabaseClient
    .from("vehicle_classes")
    .select("*")
    .eq("detailer_id", currentUser.id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("DetailHQ: vehicle_classes load failed:", error);
    return;
  }

  vehicleClasses = data || [];

  // Defaults anlegen, wenn keine vorhanden
  if (vehicleClasses.length === 0) {
    const defaults = [
      { name: "Kleinwagen", price_factor: 1.0, duration_factor: 1.0, sort_order: 1 },
      { name: "Mittelklasse", price_factor: 1.2, duration_factor: 1.1, sort_order: 2 },
      { name: "SUV / Transporter", price_factor: 1.4, duration_factor: 1.2, sort_order: 3 },
    ].map((v, idx) => ({
      detailer_id: currentUser.id,
      name: v.name,
      price_factor: v.price_factor,
      duration_factor: v.duration_factor,
      sort_order: v.sort_order ?? idx + 1,
    }));

    const { data: inserted, error: insertError } = await supabaseClient
      .from("vehicle_classes")
      .insert(defaults)
      .select("*");

    if (insertError) {
      console.error("DetailHQ: default vehicle_classes insert failed:", insertError);
    } else {
      vehicleClasses = inserted || [];
    }
  }

  renderVehicleClassesList();
  refreshBookingVehicleClassOptions();
}

function renderVehicleClassesList() {
  if (!vehicleClassesList) return;

  vehicleClassesList.innerHTML = "";

  if (!vehicleClasses || vehicleClasses.length === 0) {
    const p = document.createElement("p");
    p.className = "form-hint";
    p.textContent = "Noch keine Fahrzeugklassen angelegt.";
    vehicleClassesList.appendChild(p);
    return;
  }

  vehicleClasses.forEach((vc) => {
    const row = document.createElement("div");
    row.className = "settings-row";

    const left = document.createElement("div");
    left.className = "settings-row-main";
    const title = document.createElement("div");
    title.className = "settings-row-title";
    title.textContent = vc.name;
    const meta = document.createElement("div");
    meta.className = "settings-row-meta";
    meta.textContent = `Preisfaktor: ${vc.price_factor ?? 1.0} · Zeitfaktor: ${vc.duration_factor ?? 1.0}`;

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "settings-row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-button small";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => openVehicleClassModal(vc));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-button small danger";
    delBtn.textContent = "🗑";
    delBtn.addEventListener("click", () => deleteVehicleClass(vc.id));

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    row.appendChild(left);
    row.appendChild(right);

    vehicleClassesList.appendChild(row);
  });
}

function openVehicleClassModal(vc) {
  if (!vehicleClassModal) return;

  if (vehicleClassModalError) vehicleClassModalError.textContent = "";

  if (vc) {
    vehicleClassModalTitle.textContent = "Fahrzeugklasse bearbeiten";
    vehicleClassModal.dataset.id = vc.id;
    vehicleClassNameInput.value = vc.name || "";
    vehicleClassPriceFactorInput.value = vc.price_factor ?? 1.0;
    vehicleClassDurationFactorInput.value = vc.duration_factor ?? 1.0;
  } else {
    vehicleClassModalTitle.textContent = "Fahrzeugklasse hinzufügen";
    delete vehicleClassModal.dataset.id;
    vehicleClassNameInput.value = "";
    vehicleClassPriceFactorInput.value = "1.0";
    vehicleClassDurationFactorInput.value = "1.0";
  }

  vehicleClassModal.classList.remove("hidden");
}

function closeVehicleClassModal() {
  if (!vehicleClassModal) return;
  vehicleClassModal.classList.add("hidden");
}

async function deleteVehicleClass(id) {
  if (!currentUser || !supabaseClient) return;
  if (!confirm("Fahrzeugklasse wirklich löschen?")) return;

  const { error } = await supabaseClient
    .from("vehicle_classes")
    .delete()
    .eq("id", id)
    .eq("detailer_id", currentUser.id);

  if (error) {
    console.error("DetailHQ: delete vehicle_class failed:", error);
    return;
  }

  vehicleClasses = vehicleClasses.filter((vc) => vc.id !== id);
  renderVehicleClassesList();
  refreshBookingVehicleClassOptions();
}

async function loadServices() {
  if (!currentUser || !supabaseClient || !servicesList) return;

  const { data, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("detailer_id", currentUser.id)
    .order("name", { ascending: true });

  if (error) {
    console.error("DetailHQ: services load failed:", error);
    return;
  }

  services = data || [];
  renderServicesList();
  refreshBookingServiceOptions();
}

function renderServicesList() {
  if (!servicesList) return;

  servicesList.innerHTML = "";

  if (!services || services.length === 0) {
    const p = document.createElement("p");
    p.className = "form-hint";
    p.textContent = "Noch keine Services angelegt.";
    servicesList.appendChild(p);
    return;
  }

  services.forEach((svc) => {
    const row = document.createElement("div");
    row.className = "settings-row";

    const left = document.createElement("div");
    left.className = "settings-row-main";

    const title = document.createElement("div");
    title.className = "settings-row-title";
    title.textContent = svc.name;

    const meta = document.createElement("div");
    meta.className = "settings-row-meta";

    const kindLabel =
      svc.kind === "package"
        ? "Paket"
        : svc.kind === "single"
        ? "Einzelleistung"
        : "Add-on";

    const priceEuro = (svc.base_price_cents || 0) / 100;
    const priceText = priceEuro.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
    });

    const durationText = svc.base_duration_minutes
      ? `${svc.base_duration_minutes} Min.`
      : "ohne Zeitangabe";

    const categoryText = svc.category ? ` · Kategorie: ${svc.category}` : "";

    meta.textContent = `${kindLabel} · ${priceText} · ${durationText}${categoryText}`;

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "settings-row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-button small";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => openServiceModal(svc));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-button small danger";
    delBtn.textContent = "🗑";
    delBtn.addEventListener("click", () => deleteService(svc.id));

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    row.appendChild(left);
    row.appendChild(right);

    servicesList.appendChild(row);
  });
}

function openServiceModal(svc) {
  if (!serviceModal) return;
  if (serviceModalError) serviceModalError.textContent = "";

  if (svc) {
    serviceModalTitle.textContent = "Service bearbeiten";
    serviceModal.dataset.id = svc.id;
    serviceKindInput.value = svc.kind || "package";
    serviceCategoryInput.value = svc.category || "";
    serviceNameInput.value = svc.name || "";
    servicePriceInput.value = ((svc.base_price_cents || 0) / 100).toString();
    serviceDurationInput.value = svc.base_duration_minutes || "";
    serviceDescriptionInput.value = svc.description || "";
  } else {
    serviceModalTitle.textContent = "Service hinzufügen";
    delete serviceModal.dataset.id;
    serviceKindInput.value = "package";
    serviceCategoryInput.value = "";
    serviceNameInput.value = "";
    servicePriceInput.value = "";
    serviceDurationInput.value = "";
    serviceDescriptionInput.value = "";
  }

  serviceModal.classList.remove("hidden");
}

function closeServiceModal() {
  if (!serviceModal) return;
  serviceModal.classList.add("hidden");
}

async function deleteService(id) {
  if (!currentUser || !supabaseClient) return;
  if (!confirm("Service wirklich löschen?")) return;

  const { error } = await supabaseClient
    .from("services")
    .delete()
    .eq("id", id)
    .eq("detailer_id", currentUser.id);

  if (error) {
    console.error("DetailHQ: delete service failed:", error);
    return;
  }

  services = services.filter((svc) => svc.id !== id);
  renderServicesList();
  refreshBookingServiceOptions();
}

function setupServiceManagementHandlers() {
  // Vehicle classes
  if (vehicleClassAddButton) {
    vehicleClassAddButton.addEventListener("click", () => openVehicleClassModal(null));
  }
  if (vehicleClassModalClose) {
    vehicleClassModalClose.addEventListener("click", () => closeVehicleClassModal());
  }
  if (vehicleClassModal) {
    vehicleClassModal.addEventListener("click", (e) => {
      if (e.target === vehicleClassModal || e.target.classList.contains("profile-modal-backdrop")) {
        closeVehicleClassModal();
      }
    });
  }
  if (vehicleClassForm) {
    vehicleClassForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser || !supabaseClient) return;

      if (vehicleClassModalError) vehicleClassModalError.textContent = "";

      const name = vehicleClassNameInput.value.trim();
      if (!name) {
        if (vehicleClassModalError) {
          vehicleClassModalError.textContent = "Name darf nicht leer sein.";
        }
        return;
      }

      const priceFactor = parseFloat(vehicleClassPriceFactorInput.value || "1") || 1.0;
      const durationFactor = parseFloat(
        vehicleClassDurationFactorInput.value || "1"
      ) || 1.0;

      const existingId = vehicleClassModal.dataset.id;
      if (existingId) {
        const { error } = await supabaseClient
          .from("vehicle_classes")
          .update({
            name,
            price_factor: priceFactor,
            duration_factor: durationFactor,
          })
          .eq("id", existingId)
          .eq("detailer_id", currentUser.id);

        if (error) {
          console.error("DetailHQ: update vehicle_class failed:", error);
          if (vehicleClassModalError) {
            vehicleClassModalError.textContent =
              "Fehler beim Speichern. Bitte später erneut versuchen.";
          }
          return;
        }
      } else {
        const sortOrder = (vehicleClasses?.length || 0) + 1;
        const { data, error } = await supabaseClient
          .from("vehicle_classes")
          .insert({
            detailer_id: currentUser.id,
            name,
            price_factor: priceFactor,
            duration_factor: durationFactor,
            sort_order: sortOrder,
          })
          .select("*")
          .single();

        if (error) {
          console.error("DetailHQ: insert vehicle_class failed:", error);
          if (vehicleClassModalError) {
            vehicleClassModalError.textContent =
              "Fehler beim Speichern. Bitte später erneut versuchen.";
          }
          return;
        }

        vehicleClasses.push(data);
      }

      await loadVehicleClasses();
      closeVehicleClassModal();
    });
  }

  // Services
  if (serviceAddButton) {
    serviceAddButton.addEventListener("click", () => openServiceModal(null));
  }
  if (serviceModalClose) {
    serviceModalClose.addEventListener("click", () => closeServiceModal());
  }
  if (serviceModal) {
    serviceModal.addEventListener("click", (e) => {
      if (e.target === serviceModal || e.target.classList.contains("profile-modal-backdrop")) {
        closeServiceModal();
      }
    });
  }
  if (serviceForm) {
    serviceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser || !supabaseClient) return;

      if (serviceModalError) serviceModalError.textContent = "";

      const kind = serviceKindInput.value;
      const category = serviceCategoryInput.value.trim() || null;
      const name = serviceNameInput.value.trim();
      const priceEuro = parseFloat(servicePriceInput.value || "0") || 0;
      const durationMinutes = serviceDurationInput.value
        ? parseInt(serviceDurationInput.value, 10) || 0
        : 0;
      const description = serviceDescriptionInput.value.trim() || null;

      if (!name) {
        if (serviceModalError) {
          serviceModalError.textContent = "Name darf nicht leer sein.";
        }
        return;
      }

      const base_price_cents = Math.round(priceEuro * 100);

      const payload = {
        detailer_id: currentUser.id,
        kind,
        category,
        name,
        description,
        base_price_cents,
        base_duration_minutes: durationMinutes,
      };

      const existingId = serviceModal.dataset.id;

      if (existingId) {
        const { error } = await supabaseClient
          .from("services")
          .update(payload)
          .eq("id", existingId)
          .eq("detailer_id", currentUser.id);

        if (error) {
          console.error("DetailHQ: update service failed:", error);
          if (serviceModalError) {
            serviceModalError.textContent =
              "Fehler beim Speichern. Bitte später erneut versuchen.";
          }
          return;
        }
      } else {
        const { error } = await supabaseClient.from("services").insert(payload);
        if (error) {
          console.error("DetailHQ: insert service failed:", error);
          if (serviceModalError) {
            serviceModalError.textContent =
              "Fehler beim Speichern. Bitte später erneut versuchen.";
          }
          return;
        }
      }

      await loadServices();
      closeServiceModal();
    });
  }
}

// Helper: Booking selects
function refreshBookingVehicleClassOptions() {
  if (!bookingVehicleClassSelect) return;

  bookingVehicleClassSelect.innerHTML = "";
  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Keine Auswahl";
  bookingVehicleClassSelect.appendChild(optNone);

  if (!vehicleClasses) return;

  vehicleClasses.forEach((vc) => {
    const opt = document.createElement("option");
    opt.value = vc.id;
    opt.textContent = vc.name;
    bookingVehicleClassSelect.appendChild(opt);
  });
}

function refreshBookingServiceOptions() {
  if (!bookingMainServiceSelect || !bookingSinglesList || !bookingAddonsList) return;

  // Paket-Dropdown
  bookingMainServiceSelect.innerHTML = "";
  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Kein Paket";
  bookingMainServiceSelect.appendChild(optNone);

  const packages = (services || []).filter((s) => s.kind === "package");
  packages.forEach((svc) => {
    const opt = document.createElement("option");
    opt.value = svc.id;
    opt.textContent = svc.name;
    bookingMainServiceSelect.appendChild(opt);
  });

  // Einzelleistungen
  bookingSinglesList.innerHTML = "";
  const singles = (services || []).filter((s) => s.kind === "single");
  if (singles.length === 0) {
    const p = document.createElement("p");
    p.className = "form-hint";
    p.textContent = "Noch keine Einzelleistungen angelegt.";
    bookingSinglesList.appendChild(p);
  } else {
    singles.forEach((svc) => {
      const row = document.createElement("label");
      row.className = "checkbox-row";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = svc.id;
      input.className = "booking-single-checkbox";

      const span = document.createElement("span");
      const priceEuro = (svc.base_price_cents || 0) / 100;
      const priceText = priceEuro.toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
      });
      span.textContent = `${svc.name} (${priceText})`;

      row.appendChild(input);
      row.appendChild(span);

      bookingSinglesList.appendChild(row);
    });
  }

  // Add-ons
  bookingAddonsList.innerHTML = "";
  const addons = (services || []).filter((s) => s.kind === "addon");
  if (addons.length === 0) {
    const p = document.createElement("p");
    p.className = "form-hint";
    p.textContent = "Noch keine Add-ons definiert.";
    bookingAddonsList.appendChild(p);
  } else {
    addons.forEach((svc) => {
      const row = document.createElement("label");
      row.className = "checkbox-row";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = svc.id;
      input.className = "booking-addon-checkbox";

      const span = document.createElement("span");
      const priceEuro = (svc.base_price_cents || 0) / 100;
      const priceText = priceEuro.toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
      });
      span.textContent = `${svc.name} (${priceText})`;

      row.appendChild(input);
      row.appendChild(span);

      bookingAddonsList.appendChild(row);
    });
  }
}

// ================================
// BOOKING / NEUER AUFTRAG
// ================================
function setupBookingHandlers() {
  if (newBookingButton) {
    newBookingButton.addEventListener("click", () => openBookingModal());
  }
  if (newBookingButton2) {
    newBookingButton2.addEventListener("click", () => openBookingModal());
  }
  if (bookingCloseButton) {
    bookingCloseButton.addEventListener("click", () => closeBookingModal());
  }
  if (bookingModal) {
    bookingModal.addEventListener("click", (e) => {
      if (e.target === bookingModal || e.target.classList.contains("profile-modal-backdrop")) {
        closeBookingModal();
      }
    });
  }

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await submitBooking();
    });
  }

  if (bookingVehicleClassSelect) {
    bookingVehicleClassSelect.addEventListener("change", recalcBookingSummary);
  }
  if (bookingMainServiceSelect) {
    bookingMainServiceSelect.addEventListener("change", recalcBookingSummary);
  }
  if (bookingSinglesList) {
    bookingSinglesList.addEventListener("change", (e) => {
      if (e.target && e.target.matches(".booking-single-checkbox")) {
        recalcBookingSummary();
      }
    });
  }
  if (bookingAddonsList) {
    bookingAddonsList.addEventListener("change", (e) => {
      if (e.target && e.target.matches(".booking-addon-checkbox")) {
        recalcBookingSummary();
      }
    });
  }
}

function openBookingModal() {
  if (!currentUser) {
    alert("Bitte zuerst anmelden.");
    return;
  }
  if (!bookingModal) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);
  if (bookingDateInput && !bookingDateInput.value) {
    bookingDateInput.value = todayStr;
  }
  if (bookingTimeInput && !bookingTimeInput.value) {
    bookingTimeInput.value = timeStr;
  }

  if (bookingError) bookingError.textContent = "";

  if (bookingCarInput) bookingCarInput.value = "";
  if (bookingCustomerNameInput) bookingCustomerNameInput.value = "";
  if (bookingCustomerEmailInput) bookingCustomerEmailInput.value = "";
  if (bookingCustomerPhoneInput) bookingCustomerPhoneInput.value = "";
  if (bookingCustomerAddressInput) bookingCustomerAddressInput.value = "";
  if (bookingNotesInput) bookingNotesInput.value = "";
  if (bookingJobStatusSelect) bookingJobStatusSelect.value = "planned";
  if (bookingPaymentStatusSelect) bookingPaymentStatusSelect.value = "open";

  if (bookingMainServiceSelect) bookingMainServiceSelect.value = "";
  if (bookingSinglesList) {
    bookingSinglesList
      .querySelectorAll("input[type=checkbox]")
      .forEach((cb) => (cb.checked = false));
  }
  if (bookingAddonsList) {
    bookingAddonsList
      .querySelectorAll("input[type=checkbox]")
      .forEach((cb) => (cb.checked = false));
  }

  recalcBookingSummary();

  bookingModal.classList.remove("hidden");
}

function closeBookingModal() {
  if (!bookingModal) return;
  bookingModal.classList.add("hidden");
}

function recalcBookingSummary() {
  if (!bookingSummaryPrice || !bookingSummaryDuration) return;

  let totalPriceCents = 0;
  let totalMinutes = 0;

  let priceFactor = 1.0;
  let durationFactor = 1.0;

  if (bookingVehicleClassSelect && bookingVehicleClassSelect.value) {
    const vcId = bookingVehicleClassSelect.value;
    const vc = (vehicleClasses || []).find((v) => v.id === vcId);
    if (vc) {
      priceFactor = vc.price_factor ?? 1.0;
      durationFactor = vc.duration_factor ?? 1.0;
    }
  }

  const getServiceById = (id) => (services || []).find((s) => s.id === id);

  // Paket
  if (bookingMainServiceSelect && bookingMainServiceSelect.value) {
    const main = getServiceById(bookingMainServiceSelect.value);
    if (main) {
      totalPriceCents += Math.round((main.base_price_cents || 0) * priceFactor);
      if (main.base_duration_minutes) {
        totalMinutes += Math.round(main.base_duration_minutes * durationFactor);
      }
    }
  }

  // Einzelleistungen
  if (bookingSinglesList) {
    const checkboxes = bookingSinglesList.querySelectorAll(".booking-single-checkbox");
    checkboxes.forEach((cb) => {
      if (!cb.checked) return;
      const svc = getServiceById(cb.value);
      if (!svc) return;
      totalPriceCents += Math.round((svc.base_price_cents || 0) * priceFactor);
      if (svc.base_duration_minutes) {
        totalMinutes += Math.round(svc.base_duration_minutes * durationFactor);
      }
    });
  }

  // Add-ons
  if (bookingAddonsList) {
    const checkboxes = bookingAddonsList.querySelectorAll(".booking-addon-checkbox");
    checkboxes.forEach((cb) => {
      if (!cb.checked) return;
      const svc = getServiceById(cb.value);
      if (!svc) return;

      if (
        bookingMainServiceSelect &&
        bookingMainServiceSelect.value &&
        bookingMainServiceSelect.value === svc.id
      ) {
        return;
      }

      totalPriceCents += Math.round((svc.base_price_cents || 0) * priceFactor);
      if (svc.base_duration_minutes) {
        totalMinutes += Math.round(svc.base_duration_minutes * durationFactor);
      }
    });
  }

  const priceEuro = totalPriceCents / 100;
  bookingSummaryPrice.textContent = priceEuro.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
  bookingSummaryDuration.textContent = `${totalMinutes} Min.`;
}

async function submitBooking() {
  if (!currentUser || !supabaseClient) return;
  if (bookingError) bookingError.textContent = "";

  if (!bookingDateInput || !bookingTimeInput) return;

  const dateStr = bookingDateInput.value;
  const timeStr = bookingTimeInput.value || "09:00";

  if (!dateStr) {
    if (bookingError) bookingError.textContent = "Bitte Datum auswählen.";
    return;
  }

  const startAt = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(startAt.getTime())) {
    if (bookingError) bookingError.textContent = "Ungültiges Datum / Uhrzeit.";
    return;
  }

  let priceFactor = 1.0;
  let durationFactor = 1.0;
  let vehicleClassId = null;
  let vehicleClassName = null;

  if (bookingVehicleClassSelect && bookingVehicleClassSelect.value) {
    vehicleClassId = bookingVehicleClassSelect.value;
    const vc = (vehicleClasses || []).find((v) => v.id === vehicleClassId);
    if (vc) {
      vehicleClassName = vc.name || null;
      priceFactor = vc.price_factor ?? 1.0;
      durationFactor = vc.duration_factor ?? 1.0;
    }
  }

  const getServiceById = (id) => (services || []).find((s) => s.id === id);

  let items = [];
  let totalPriceCents = 0;
  let totalMinutes = 0;

  let mainServiceName = null;
  if (bookingMainServiceSelect && bookingMainServiceSelect.value) {
    const main = getServiceById(bookingMainServiceSelect.value);
    if (main) {
      mainServiceName = main.name;
      const price = Math.round((main.base_price_cents || 0) * priceFactor);
      const dur = main.base_duration_minutes
        ? Math.round(main.base_duration_minutes * durationFactor)
        : 0;
      items.push({
        role: "package",
        service_id: main.id,
        name: main.name,
        base_price_cents: main.base_price_cents || 0,
        price_cents: price,
        base_duration_minutes: main.base_duration_minutes || 0,
        duration_minutes: dur,
      });
      totalPriceCents += price;
      totalMinutes += dur;
    }
  }

  if (bookingSinglesList) {
    const checkboxes = bookingSinglesList.querySelectorAll(".booking-single-checkbox");
    checkboxes.forEach((cb) => {
      if (!cb.checked) return;
      const svc = getServiceById(cb.value);
      if (!svc) return;
      const price = Math.round((svc.base_price_cents || 0) * priceFactor);
      const dur = svc.base_duration_minutes
        ? Math.round(svc.base_duration_minutes * durationFactor)
        : 0;

      items.push({
        role: "single",
        service_id: svc.id,
        name: svc.name,
        base_price_cents: svc.base_price_cents || 0,
        price_cents: price,
        base_duration_minutes: svc.base_duration_minutes || 0,
        duration_minutes: dur,
      });

      totalPriceCents += price;
      totalMinutes += dur;
    });
  }

  if (bookingAddonsList) {
    const checkboxes = bookingAddonsList.querySelectorAll(".booking-addon-checkbox");
    checkboxes.forEach((cb) => {
      if (!cb.checked) return;
      const svc = getServiceById(cb.value);
      if (!svc) return;

      if (
        bookingMainServiceSelect &&
        bookingMainServiceSelect.value &&
        bookingMainServiceSelect.value === svc.id
      ) {
        return;
      }

      const price = Math.round((svc.base_price_cents || 0) * priceFactor);
      const dur = svc.base_duration_minutes
        ? Math.round(svc.base_duration_minutes * durationFactor)
        : 0;

      items.push({
        role: "addon",
        service_id: svc.id,
        name: svc.name,
        base_price_cents: svc.base_price_cents || 0,
        price_cents: price,
        base_duration_minutes: svc.base_duration_minutes || 0,
        duration_minutes: dur,
      });

      totalPriceCents += price;
      totalMinutes += dur;
    });
  }

  const car = bookingCarInput ? bookingCarInput.value.trim() || null : null;
  const notes = bookingNotesInput ? bookingNotesInput.value.trim() || null : null;
  const customerName = bookingCustomerNameInput
    ? bookingCustomerNameInput.value.trim() || null
    : null;
  const customerEmail = bookingCustomerEmailInput
    ? bookingCustomerEmailInput.value.trim() || null
    : null;
  const customerPhone = bookingCustomerPhoneInput
    ? bookingCustomerPhoneInput.value.trim() || null
    : null;
  const customerAddress = bookingCustomerAddressInput
    ? bookingCustomerAddressInput.value.trim() || null
    : null;

  const jobStatus = bookingJobStatusSelect?.value || "planned";
  const paymentStatus = bookingPaymentStatusSelect?.value || "open";

  const payload = {
    detailer_id: currentUser.id,
    start_at: startAt.toISOString(),
    duration_minutes: totalMinutes,
    service_name: mainServiceName || "Auftrag",
    total_price: totalPriceCents / 100,
    notes,
    car,
    vehicle_class_id: vehicleClassId,
    vehicle_class_name: vehicleClassName,
    items: items,
    job_status: jobStatus,
    payment_status: paymentStatus,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    customer_address: customerAddress,
  };

  const { error } = await supabaseClient.from("bookings").insert(payload);
  if (error) {
    console.error("DetailHQ: booking insert failed:", error);
    if (bookingError) {
      bookingError.textContent =
        "Auftrag konnte nicht gespeichert werden. Bitte später erneut versuchen.";
    }
    return;
  }

  closeBookingModal();
  // TODO: Später: Dashboard / Zeitplan sofort neu laden
}

function setupCalendarUrlForUser() {
  if (!currentUser) return;
  const apiBase = "https://api.detailhq.de";
  currentCalendarUrl = `${apiBase}/cal/${currentUser.id}.ics`;
}
