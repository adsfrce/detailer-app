// landing.js

// Header blur on scroll
(() => {
  const header = document.querySelector("[data-header]");
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > 8) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();

// Mobile nav drawer
(() => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const drawer = document.querySelector("[data-nav-drawer]");
  const closeLinks = document.querySelectorAll("[data-nav-close]");

  if (!toggle || !drawer) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("nav-open", open);
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setOpen(!isOpen);
  });

  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) setOpen(false);
  });

  closeLinks.forEach((a) => a.addEventListener("click", () => setOpen(false)));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
})();

// Billing toggle (monthly/yearly)
(() => {
  const buttons = document.querySelectorAll(".toggle-btn[data-billing]");
  const monthlyPrice = document.querySelector("[data-price-monthly]");
  const yearlyPrice = document.querySelector("[data-price-yearly]");
  const monthlyPer = document.querySelector("[data-per-monthly]");
  const yearlyPer = document.querySelector("[data-per-yearly]");
  const monthlySub = document.querySelector("[data-subline-monthly]");
  const yearlySub = document.querySelector("[data-subline-yearly]");

  if (!buttons.length || !monthlyPrice || !yearlyPrice || !monthlyPer || !yearlyPer || !monthlySub || !yearlySub) return;

  const showMonthly = (isMonthly) => {
    monthlyPrice.hidden = !isMonthly;
    monthlyPer.hidden = !isMonthly;
    monthlySub.hidden = !isMonthly;

    yearlyPrice.hidden = isMonthly;
    yearlyPer.hidden = isMonthly;
    yearlySub.hidden = isMonthly;
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });

      showMonthly(btn.dataset.billing === "monthly");
    });
  });

  showMonthly(true);
})();

// Footer year
(() => {
  const y = document.getElementById("y");
  if (y) y.textContent = String(new Date().getFullYear());
})();
