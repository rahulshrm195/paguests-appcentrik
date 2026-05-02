// ============================================================
// app.js — Router, Auth State, Navigation Shell
// PA Guest Tracker
// ============================================================

import { onAuthChange, getUserProfile, logoutUser } from "./firebase.js";
import { t, setLang, getLang, applyTranslations, LANG_LABELS, LANGUAGES } from "./i18n.js";

// ── Page Modules (lazy imported on demand) ────────────────────
const PAGE_MODULES = {
  dashboard: () => import("./pages/dashboard.js"),
  guests: () => import("./pages/guests.js"),
  "guest-detail": () => import("./pages/guest-detail.js"),
  meetings: () => import("./pages/meetings.js"),
  attendance: () => import("./pages/attendance.js"),
  chapters: () => import("./pages/chapters.js"),
  users: () => import("./pages/users.js"),
};

// ── App State ─────────────────────────────────────────────────
export const appState = {
  user: null,
  profile: null,
  currentPage: null,
  currentChapterId: null,
  sidebarOpen: false,
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Set initial language
  setLang(getLang());

  // Check if on register page
  const hash = window.location.hash;
  if (hash === "#register") {
    showRegisterPage();
    return;
  }

  // Auth listener
  onAuthChange(async (user) => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      appState.user = user;
      appState.profile = profile;
      if (!profile) {
        showToast("Profile not found. Contact admin.", "error");
        await logoutUser();
        return;
      }
      initApp();
    } else {
      appState.user = null;
      appState.profile = null;
      showLoginPage();
    }
  });

  // Handle hash changes
  window.addEventListener("hashchange", () => {
    const h = window.location.hash.replace("#", "");
    if (h === "register") {
      showRegisterPage();
    } else if (appState.user) {
      routeTo(h || "dashboard");
    }
  });
});

// ── Login Page ────────────────────────────────────────────────
function showLoginPage() {
  document.body.innerHTML = renderLoginPage();
  applyTranslations();
  bindLoginEvents();
  renderLangToggle(document.getElementById("login-lang-toggle"));
}

function renderLoginPage() {
  return `
    <div id="login-page">
      <div class="login-card fade-in">
        <div class="login-logo">
          <span class="login-logo-mark">PA</span>
          <span class="login-logo-sub">Progress Alliance · Guest Tracker</span>
        </div>

        <div id="login-lang-toggle" style="display:flex;justify-content:center;margin-bottom:20px;"></div>

        <div class="form-group">
          <label class="form-label" data-i18n="email"></label>
          <input type="email" id="login-email" class="form-control" data-i18n="email" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="password"></label>
          <input type="password" id="login-password" class="form-control" data-i18n="password" autocomplete="current-password">
        </div>
        <div id="login-error" class="form-error hidden" style="margin-bottom:12px;"></div>
        <button class="btn btn-primary btn-full btn-lg" id="login-btn">
          <span data-i18n="loginBtn"></span>
        </button>

        <hr class="login-divider">

        <button class="register-guest-btn" id="goto-register">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <span data-i18n="registerGuest"></span>
        </button>
      </div>
    </div>
    <div id="toast-container"></div>
  `;
}

function bindLoginEvents() {
  document.getElementById("login-btn").addEventListener("click", handleLogin);
  document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
  document.getElementById("goto-register").addEventListener("click", () => {
    window.location.hash = "register";
  });
}

async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");

  if (!email || !password) {
    errorEl.textContent = t("required");
    errorEl.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>`;
  errorEl.classList.add("hidden");

  try {
    const { loginUser } = await import("./firebase.js");
    await loginUser(email, password);
    // onAuthChange will handle the rest
  } catch (err) {
    errorEl.textContent = t("loginError");
    errorEl.classList.remove("hidden");
    btn.disabled = false;
    btn.innerHTML = `<span data-i18n="loginBtn">${t("loginBtn")}</span>`;
  }
}

// ── Register Guest Page (Public) ──────────────────────────────
async function showRegisterPage() {
  const { default: renderRegister } = await import("./pages/register-guest.js");
  document.body.innerHTML = renderRegister();
  applyTranslations();
  const { initRegisterPage } = await import("./pages/register-guest.js");
  initRegisterPage();
  renderLangToggle(document.getElementById("register-lang-toggle"));
}

// ── App Shell ─────────────────────────────────────────────────
function initApp() {
  document.body.innerHTML = renderAppShell();
  renderSidebar();
  renderLangToggle(document.getElementById("header-lang-toggle"));
  bindAppEvents();

  const hash = window.location.hash.replace("#", "");
  routeTo(hash || "dashboard");
}

function renderAppShell() {
  return `
    <div id="app">
      <aside id="sidebar"></aside>
      <div id="sidebar-overlay"></div>

      <div id="main">
        <header id="header">
          <div class="flex items-center gap-2">
            <button class="hamburger-btn" id="hamburger">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 class="header-title" id="header-title">PA Guest Tracker</h1>
          </div>
          <div class="header-actions">
            <div id="header-lang-toggle"></div>
          </div>
        </header>

        <div id="page-content"></div>
      </div>
    </div>
    <div id="toast-container"></div>
  `;
}

function renderSidebar() {
  const profile = appState.profile;
  const role = profile?.role || "desk";
  const initials = (profile?.name || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const roleLabel = {
    superAdmin: t("roleSuperAdmin"),
    chapterAdmin: t("roleChapterAdmin"),
    desk: t("roleDesk"),
  }[role] || role;

  const navItems = getNavItems(role);

  document.getElementById("sidebar").innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-mark">PA Guest Tracker</div>
      <div class="logo-sub">Progress Alliance</div>
    </div>

    ${role !== "superAdmin" && profile?.currentChapterName ? `
      <div class="sidebar-chapter-badge">
        <span class="badge-label">${t("chapter")}</span>
        ${profile.currentChapterName}
      </div>
    ` : ""}

    <nav class="sidebar-nav" id="sidebar-nav">
      ${navItems.map(item => `
        <div class="nav-item" data-page="${item.page}" id="nav-${item.page}">
          ${item.icon}
          <span data-i18n="${item.labelKey}"></span>
        </div>
      `).join("")}
    </nav>

    <div class="sidebar-bottom">
      <div class="user-info">
        <div class="user-avatar">${initials}</div>
        <div>
          <div class="user-name">${profile?.name || "User"}</div>
          <div class="user-role">${roleLabel}</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm btn-full" id="logout-btn">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        <span data-i18n="logout"></span>
      </button>
    </div>
  `;

  applyTranslations();

  // Nav item clicks
  document.getElementById("sidebar-nav").addEventListener("click", (e) => {
    const item = e.target.closest(".nav-item");
    if (item) {
      const page = item.dataset.page;
      window.location.hash = page;
      closeSidebar();
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await logoutUser();
  });
}

function getNavItems(role) {
  const icons = {
    dashboard: `<svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    guests: `<svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
    meetings: `<svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    attendance: `<svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
    chapters: `<svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    users: `<svg class="nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  };

  if (role === "superAdmin") {
    return [
      { page: "dashboard", labelKey: "dashboard", icon: icons.dashboard },
      { page: "chapters", labelKey: "chapters", icon: icons.chapters },
      { page: "users", labelKey: "users", icon: icons.users },
      { page: "guests", labelKey: "guests", icon: icons.guests },
      { page: "meetings", labelKey: "meetings", icon: icons.meetings },
    ];
  }

  if (role === "chapterAdmin") {
    return [
      { page: "dashboard", labelKey: "dashboard", icon: icons.dashboard },
      { page: "guests", labelKey: "guests", icon: icons.guests },
      { page: "meetings", labelKey: "meetings", icon: icons.meetings },
      { page: "attendance", labelKey: "attendance", icon: icons.attendance },
    ];
  }

  // desk
  return [
    { page: "attendance", labelKey: "attendance", icon: icons.attendance },
  ];
}

// ── Router ────────────────────────────────────────────────────
export async function routeTo(page, params = {}) {
  const profile = appState.profile;
  const role = profile?.role;

  // Role-based access
  const rolePages = {
    superAdmin: ["dashboard", "chapters", "users", "guests", "guest-detail", "meetings", "attendance"],
    chapterAdmin: ["dashboard", "guests", "guest-detail", "meetings", "attendance"],
    desk: ["attendance"],
  };

  const allowed = rolePages[role] || ["attendance"];
  const targetPage = allowed.includes(page) ? page : allowed[0];

  // Set active nav
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === targetPage.split("/")[0]);
  });

  // Update header title
  const titleEl = document.getElementById("header-title");
  if (titleEl) titleEl.textContent = t(targetPage.replace("-", "")) || "PA";

  // Load page module
  const content = document.getElementById("page-content");
  content.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    const mod = PAGE_MODULES[targetPage] || PAGE_MODULES["dashboard"];
    const { default: initPage } = await mod();
    appState.currentPage = targetPage;
    content.innerHTML = "";
    await initPage(content, params);
  } catch (err) {
    console.error("Page load error:", err);
    content.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>${err.message}</p></div>`;
  }
}

// ── App Events ────────────────────────────────────────────────
function bindAppEvents() {
  document.getElementById("hamburger")?.addEventListener("click", toggleSidebar);
  document.getElementById("sidebar-overlay")?.addEventListener("click", closeSidebar);
}

function toggleSidebar() {
  appState.sidebarOpen = !appState.sidebarOpen;
  document.getElementById("sidebar").classList.toggle("open", appState.sidebarOpen);
  document.getElementById("sidebar-overlay").classList.toggle("visible", appState.sidebarOpen);
}

function closeSidebar() {
  appState.sidebarOpen = false;
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("visible");
}

// ── Language Toggle ───────────────────────────────────────────
export function renderLangToggle(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="lang-toggle">
      ${LANGUAGES.map(lang => `
        <button class="lang-btn ${getLang() === lang ? "active" : ""}" data-lang="${lang}">
          ${LANG_LABELS[lang]}
        </button>
      `).join("")}
    </div>
  `;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".lang-btn");
    if (!btn) return;
    const lang = btn.dataset.lang;
    setLang(lang);
    applyTranslations();

    // Update all lang buttons
    container.querySelectorAll(".lang-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === lang);
    });

    // Re-render current page if in app
    if (appState.currentPage) {
      routeTo(appState.currentPage);
      renderSidebar();
    }
  });
}

// ── Toast ─────────────────────────────────────────────────────
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Status Badge Helper ───────────────────────────────────────
export function statusBadge(status) {
  const map = {
    New: ["badge-new", "statusNew"],
    Attending: ["badge-attending", "statusAttending"],
    Interested: ["badge-interested", "statusInterested"],
    Converted: ["badge-converted", "statusConverted"],
    NotInterested: ["badge-not-interested", "statusNotInterested"],
    Ghosted: ["badge-ghosted", "statusGhosted"],
  };
  const [cls, key] = map[status] || ["badge-new", "statusNew"];
  return `<span class="status-badge ${cls}">${t(key)}</span>`;
}

// ── Format Date ───────────────────────────────────────────────
export function formatDate(dateVal) {
  if (!dateVal) return "—";
  const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateShort(dateVal) {
  if (!dateVal) return "—";
  const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
  return { day: d.getDate(), month: d.toLocaleString("en-IN", { month: "short" }).toUpperCase() };
}
