// ============================================================
// pages/dashboard.js — Dashboard for all roles
// ============================================================

import { appState, statusBadge, formatDate, routeTo } from "../app.js";
import {
  getGuests, getAllGuests, getMeetings, getChapters,
  getChaptersByAdmin, getUpcomingMeetings
} from "../firebase.js";
import { t } from "../i18n.js";

export default async function initDashboard(container) {
  const profile = appState.profile;
  const role = profile?.role;

  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    if (role === "superAdmin") {
      await renderSuperAdminDashboard(container);
    } else {
      await renderChapterDashboard(container, profile);
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>${err.message}</p></div>`;
  }
}

// ── Super Admin Dashboard ─────────────────────────────────────
async function renderSuperAdminDashboard(container) {
  const [chapters, allGuests] = await Promise.all([
    getChapters(),
    getAllGuests(),
  ]);

  const stats = calcStats(allGuests);
  const convRate = allGuests.length > 0
    ? Math.round((stats.converted / allGuests.length) * 100)
    : 0;

  const chapterStats = chapters.map((ch) => {
    const chGuests = allGuests.filter((g) => g.chapterId === ch.id);
    return {
      ...ch,
      total: chGuests.length,
      converted: chGuests.filter((g) => g.status === "Converted").length,
    };
  }).sort((a, b) => b.total - a.total);

  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">${t("dashboard")}</h1>
          <div class="page-subtitle">${t("allChapters")} · ${chapters.length} chapters</div>
        </div>
      </div>

      <div class="stats-grid">
        ${statCard(allGuests.length, t("totalGuests"), "var(--gold)", "👥")}
        ${statCard(stats.converted, t("converted"), "var(--status-converted)", "✅")}
        ${statCard(stats.interested, t("interested"), "var(--status-interested)", "🤝")}
        ${statCard(stats.attending, t("attending"), "var(--status-attending)", "📅")}
        ${statCard(stats.new, t("newGuests"), "var(--status-new)", "🆕")}
        ${statCard(convRate + "%", t("conversionRate"), "var(--gold)", "📊")}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Chapter Performance</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>${t("chapterName")}</th>
                <th>${t("chapterCity")}</th>
                <th>${t("totalGuests")}</th>
                <th>${t("converted")}</th>
                <th>${t("conversionRate")}</th>
              </tr>
            </thead>
            <tbody>
              ${chapterStats.map(ch => `
                <tr style="cursor:pointer;" onclick="window.location.hash='guests'">
                  <td><strong>${ch.name}</strong></td>
                  <td style="color:var(--text-muted)">${ch.city || "—"}</td>
                  <td>${ch.total}</td>
                  <td style="color:var(--status-converted)">${ch.converted}</td>
                  <td>${ch.total > 0 ? Math.round((ch.converted / ch.total) * 100) : 0}%</td>
                </tr>
              `).join("")}
              ${chapterStats.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">${t("noData")}</td></tr>` : ""}
            </tbody>
          </table>

          <!-- Mobile chapter cards -->
          <div class="hidden-desktop" style="display:none;">
            ${chapterStats.map(ch => `
              <div class="guest-item">
                <div class="guest-avatar">${(ch.name[0] || "C").toUpperCase()}</div>
                <div class="guest-info">
                  <div class="guest-name">${ch.name}</div>
                  <div class="guest-meta">${ch.city || ""} · ${ch.total} guests · ${ch.converted} converted</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  // Show mobile view on small screens
  if (window.innerWidth <= 768) {
    container.querySelector(".data-table").style.display = "none";
    container.querySelector(".hidden-desktop").style.display = "block";
  }
}

// ── Chapter Admin Dashboard ───────────────────────────────────
async function renderChapterDashboard(container, profile) {
  const chapters = await getChaptersByAdmin(appState.user?.uid || profile?.id);

  // If multi-chapter, show picker or use stored
  let chapterId = appState.currentChapterId;
  if (!chapterId && chapters.length > 0) {
    chapterId = chapters[0].id;
    appState.currentChapterId = chapterId;
  }

  if (!chapterId) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🏠</span>
        <p>No chapter assigned. Contact your Super Admin.</p>
      </div>
    `;
    return;
  }

  const [guests, upcomingMeetings] = await Promise.all([
    getGuests(chapterId),
    getUpcomingMeetings(chapterId),
  ]);

  const stats = calcStats(guests);
  const nextMeeting = upcomingMeetings[0];
  const thisMonth = new Date();
  const monthGuests = guests.filter((g) => {
    const d = g.createdAt?.toDate ? g.createdAt.toDate() : new Date(g.createdAt || 0);
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
  });

  // Guests expected at next meeting
  const nextMeetingGuests = nextMeeting
    ? guests.filter((g) => g.expectedMeetingId === nextMeeting.id)
    : [];

  const recentGuests = [...guests].slice(0, 5);

  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">${t("dashboard")}</h1>
          ${chapters.length > 1 ? `
            <select id="chapter-switcher" class="form-control" style="margin-top:8px;max-width:240px;">
              ${chapters.map(ch => `<option value="${ch.id}" ${ch.id === chapterId ? "selected" : ""}>${ch.name}</option>`).join("")}
            </select>
          ` : `<div class="page-subtitle">${chapters[0]?.name || ""}</div>`}
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='guests'">
          + ${t("addGuest")}
        </button>
      </div>

      <div class="stats-grid">
        ${statCard(guests.length, t("totalGuests"), "var(--gold)", "👥")}
        ${statCard(monthGuests.length, t("thisMonthGuests"), "var(--info)", "📅")}
        ${statCard(stats.converted, t("converted"), "var(--status-converted)", "✅")}
        ${statCard(stats.interested, t("interested"), "var(--status-interested)", "🤝")}
        ${statCard(stats.attending, t("attending"), "var(--status-attending)", "📅")}
        ${statCard(stats.new, t("newGuests"), "var(--status-new)", "🆕")}
      </div>

      <!-- Next Meeting Card -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <span class="card-title">🗓 ${t("upcomingMeeting")}</span>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='meetings'">${t("meetings")}</button>
        </div>
        ${nextMeeting ? `
          <div class="flex items-center gap-3">
            <div class="meeting-date-badge">
              <span class="meeting-date-day">${formatDateShort(nextMeeting.date).day}</span>
              <span class="meeting-date-month">${formatDateShort(nextMeeting.date).month}</span>
            </div>
            <div>
              <div style="font-weight:600;">${nextMeeting.venue || "—"}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
                ${nextMeetingGuests.length} guest(s) expected · ${nextMeeting.attendees?.length || 0} confirmed
              </div>
            </div>
            <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="window.location.hash='attendance'">
              ${t("markAttendance")}
            </button>
          </div>
        ` : `<p class="text-muted">${t("noUpcomingMeeting")}</p>`}
      </div>

      <!-- Recent Guests -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">👤 ${t("recentGuests")}</span>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='guests'">${t("guests")}</button>
        </div>
        ${recentGuests.length === 0 ? `
          <div class="empty-state" style="padding:24px;">
            <span class="empty-state-icon" style="font-size:2rem;">👥</span>
            <p>${t("noData")}</p>
          </div>
        ` : recentGuests.map((g) => `
          <div class="guest-item" onclick="routeToGuest('${g.id}')">
            <div class="guest-avatar">${(g.name[0] || "G").toUpperCase()}</div>
            <div class="guest-info">
              <div class="guest-name">${g.name}</div>
              <div class="guest-meta">${g.businessName || g.businessType || "—"} · ${t("referredByName")}: ${g.referredByName || "—"}</div>
            </div>
            ${statusBadge(g.status)}
          </div>
        `).join("")}
      </div>
    </div>
  `;

  // Chapter switcher
  document.getElementById("chapter-switcher")?.addEventListener("change", (e) => {
    appState.currentChapterId = e.target.value;
    initDashboard(container);
  });

  // Make route function available
  window.routeToGuest = (id) => routeTo("guest-detail", { guestId: id });
}

// ── Helpers ───────────────────────────────────────────────────
function calcStats(guests) {
  return {
    new: guests.filter((g) => g.status === "New").length,
    attending: guests.filter((g) => g.status === "Attending").length,
    interested: guests.filter((g) => g.status === "Interested").length,
    converted: guests.filter((g) => g.status === "Converted").length,
    notInterested: guests.filter((g) => g.status === "NotInterested").length,
    ghosted: guests.filter((g) => g.status === "Ghosted").length,
  };
}

function statCard(value, label, accentColor, emoji) {
  return `
    <div class="stat-card" style="--accent-color:${accentColor};">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

function formatDateShort(dateVal) {
  if (!dateVal) return { day: "—", month: "—" };
  const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
  return {
    day: d.getDate(),
    month: d.toLocaleString("en-IN", { month: "short" }).toUpperCase(),
  };
}
