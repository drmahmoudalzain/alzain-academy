import { p } from "../lib/base.js";
import { initFirstVisitModal } from "../lib/first-visit.js";

document.querySelectorAll("[data-site-path]").forEach((link) => {
  link.href = p(link.dataset.sitePath);
});

const menuToggle = document.getElementById("mobileMenuToggle");
const mobileNav = document.getElementById("mobileNav");

function setMenuOpen(open) {
  if (!menuToggle || !mobileNav) return;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
  mobileNav.classList.toggle("is-open", open);
}

menuToggle?.addEventListener("click", () => {
  setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

mobileNav?.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("a")) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

document.addEventListener("click", (event) => {
  if (
    menuToggle?.getAttribute("aria-expanded") === "true" &&
    event.target instanceof Element &&
    !event.target.closest("#mobileNav, #mobileMenuToggle")
  ) {
    setMenuOpen(false);
  }
});

initFirstVisitModal();
