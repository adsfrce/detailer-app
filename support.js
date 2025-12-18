// ================================
// Support Page (Login required)
// ================================

const SUPABASE_URL = "https://qcilpodwbtbsxoabjfzc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaWxwb2R3YnRic3hvYWJqZnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzNTQsImV4cCI6MjA4MDg0NjM1NH0.RZ4M0bMSVhNpYZnktEyKCuJDFEpSJoyCmLFQhQLXs_w";

const APP_URL = "/app"; // Zurück zur App (dein Setup)

let supabaseClient = null;
try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });
} catch (e) {
  console.error("Support: Supabase init failed", e);
}

const el = (id) => document.getElementById(id);

const backBtn = el("support-back");
const logoutBtn = el("support-logout");
const submitBtn = el("support-submit");

const topicEl = el("support-topic");
const msgEl = el("support-message");
const errEl = el("support-error");
const successEl = el("support-success");

function setError(text) {
  if (!errEl) return;
  errEl.textContent = text || "";
}

function setSuccess(visible) {
  if (!successEl) return;
  successEl.style.display = visible ? "block" : "none";
}

function normalizeTopic(value) {
  const map = {
    problem_mit_zahlung: "Problem mit Zahlung",
    abo_verwalten: "Abo verwalten",
    app_fehler: "App-Fehler",
    login_probleme: "Login-Probleme",
    fragen: "Fragen",
    sonstiges: "Sonstiges",
  };
  return map[value] || "Sonstiges";
}

async function requireSessionOrRedirect() {
  if (!supabaseClient) {
    window.location.href = APP_URL;
    return null;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    window.location.href = APP_URL;
    return null;
  }

  const session = data?.session || null;
  if (!session?.user) {
    window.location.href = APP_URL;
    return null;
  }

  return session;
}

async function logout() {
  try {
    if (supabaseClient) await supabaseClient.auth.signOut();
  } catch (e) {}
  window.location.href = APP_URL;
}

async function sendSupportTicket(session) {
  const user = session.user;

  const topicValue = (topicEl?.value || "").trim();
  const topicLabel = normalizeTopic(topicValue);
  const message = (msgEl?.value || "").trim();

  if (!message || message.length < 8) {
    setError("Bitte beschreibe dein Anliegen (mindestens 8 Zeichen).");
    return;
  }

  setError("");
  setSuccess(false);
  submitBtn.disabled = true;
  submitBtn.textContent = "Sende...";

  // 1) Primär: Make Webhook (du kannst das in Make sofort routen: Telegram/Email/DB etc.)
  // Hinweis: Wenn dein Make-Szenario aktuell nur "new_user" verarbeitet, füge dort einfach einen Router für "support_ticket" hinzu.
  const MAKE_WEBHOOK_URL =
    "https://hook.eu1.make.com/6tf25stiy013xfr1v7ox1ewb9t9qdrth";

  const payload = {
    type: "support_ticket",
    payload: {
      user_id: user.id,
      user_email: user.email || null,
      topic: topicLabel,
      message,
      user_agent: navigator.userAgent || null,
      page: window.location.href,
      created_at: new Date().toISOString(),
    },
  };

  let ok = false;

  try {
    const res = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    ok = res.ok;
  } catch (e) {
    ok = false;
  }

  // 2) Fallback: Mailto öffnen (damit es IMMER rausgeht)
  if (!ok) {
    const subject = encodeURIComponent(`DetailHQ Support: ${topicLabel}`);
    const body = encodeURIComponent(
      `User: ${user.email || "-"}\nUserID: ${user.id}\n\nThema: ${topicLabel}\n\nNachricht:\n${message}\n`
    );
    window.location.href = `mailto:support@detailhq.de?subject=${subject}&body=${body}`;
  }

  // UI success
  msgEl.value = "";
  setSuccess(true);

  submitBtn.disabled = false;
  submitBtn.textContent = "Absenden";
}

async function init() {
  const session = await requireSessionOrRedirect();
  if (!session) return;

  backBtn?.addEventListener("click", () => {
    window.location.href = APP_URL;
  });

  logoutBtn?.addEventListener("click", logout);

  submitBtn?.addEventListener("click", async () => {
    const s = await requireSessionOrRedirect();
    if (!s) return;
    await sendSupportTicket(s);
  });

  // Optional: Enter verhindern im textarea (falls du das willst)
  // msgEl?.addEventListener("keydown", (e) => {
  //   if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitBtn.click();
  // });
}

init();
