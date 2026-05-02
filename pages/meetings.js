// ============================================================
// pages/meetings.js — Meeting Management
// ============================================================

import { appState, formatDate, showToast } from "../app.js";
import {
  getMeetings, createMeeting, updateMeeting,
  getChaptersByAdmin, getChapters, getGuests
} from "../firebase.js";
import { t } from "../i18n.js";

let currentChapterId = null;
let meetings = [];

export default async function initMeetings(container) {
  const profile = appState.profile;
  const role = profile?.role;

  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    let chapters;
    if (role === "superAdmin") {
      chapters = await getChapters();
    } else {
      chapters = await getChaptersByAdmin(profile.uid);
    }

    currentChapterId = appState.currentChapterId || chapters[0]?.id;
    if (!currentChapterId) {
      container.innerHTML = `<div class="empty-state"><p>No chapter assigned.</p></div>`;
      return;
    }

    meetings = await getMeetings(currentChapterId);
    renderMeetings(container, chapters, meetings);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>${err.message}</p></div>`;
  }
}

function renderMeetings(container, chapters, meetings) {
  const profile = appState.profile;
  const role = profile?.role;

  const upcoming = meetings.filter(m => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d >= new Date(new Date().setHours(0,0,0,0));
  });

  const past = meetings.filter(m => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d < new Date(new Date().setHours(0,0,0,0));
  });

  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">${t("meetingsList")}</h1>
          <div class="page-subtitle">${meetings.length} total · ${upcoming.length} upcoming</div>
        </div>
        <button class="btn btn-primary" id="add-meeting-btn">+ ${t("addMeeting")}</button>
      </div>

      ${chapters.length > 1 ? `
        <div style="margin-bottom:16px;">
          <select id="chapter-switcher" class="form-control" style="max-width:260px;">
            ${chapters.map(ch => `<option value="${ch.id}" ${ch.id === currentChapterId ? "selected" : ""}>${ch.name}</option>`).join("")}
          </select>
        </div>
      ` : ""}

      ${upcoming.length > 0 ? `
        <div style="margin-bottom:8px;font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Upcoming</div>
        ${upcoming.map(m => renderMeetingCard(m)).join("")}
      ` : ""}

      ${past.length > 0 ? `
        <div style="margin:16px 0 8px;font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Past</div>
        ${past.map(m => renderMeetingCard(m, true)).join("")}
      ` : ""}

      ${meetings.length === 0 ? `
        <div class="empty-state">
          <span class="empty-state-icon">📅</span>
          <p>${t("noMeetings")}</p>
          <button class="btn btn-primary" id="empty-add-btn">+ ${t("addMeeting")}</button>
        </div>
      ` : ""}
    </div>
  `;

  container.querySelector("#add-meeting-btn")?.addEventListener("click", () => showMeetingModal());
  container.querySelector("#empty-add-btn")?.addEventListener("click", () => showMeetingModal());

  container.querySelector("#chapter-switcher")?.addEventListener("change", async (e) => {
    currentChapterId = e.target.value;
    appState.currentChapterId = currentChapterId;
    meetings = await getMeetings(currentChapterId);
    renderMeetings(container, chapters, meetings);
  });

  container.querySelectorAll(".meeting-card").forEach(card => {
    card.addEventListener("click", () => {
      const meetingId = card.dataset.meetingId;
      const meeting = meetings.find(m => m.id === meetingId);
      if (meeting) showMeetingDetail(meeting);
    });
  });
}

function renderMeetingCard(m, isPast = false) {
  const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
  const day = d.getDate();
  const month = d.toLocaleString("en-IN", { month: "short" }).toUpperCase();

  return `
    <div class="meeting-card ${isPast ? "opacity-70" : ""}" data-meeting-id="${m.id}" style="${isPast ? "opacity:0.65;" : ""}">
      <div class="flex items-center gap-3" style="flex:1;">
        <div class="meeting-date-badge">
          <span class="meeting-date-day">${day}</span>
          <span class="meeting-date-month">${month}</span>
        </div>
        <div>
          <div style="font-weight:600;font-size:0.9rem;">${m.venue || "PA Meeting"}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">
            ${d.toLocaleDateString("en-IN", {weekday:"long"})} ·
            ${m.attendees?.length || 0} guests attended
          </div>
          ${m.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${m.notes}</div>` : ""}
        </div>
      </div>
      <svg width="16" height="16" fill="none" stroke="var(--text-muted)" stroke-width="2" viewBox="0 0 24 24">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  `;
}

// ── Meeting Detail Modal ──────────────────────────────────────
async function showMeetingDetail(meeting) {
  const d = meeting.date?.toDate ? meeting.date.toDate() : new Date(meeting.date);

  // Load guests for this chapter to show attendees
  let guestMap = {};
  try {
    const guests = await getGuests(meeting.chapterId);
    guests.forEach(g => { guestMap[g.id] = g; });
  } catch (_) {}

  const attendees = (meeting.attendees || []).map(id => guestMap[id]).filter(Boolean);
  const expectedGuests = Object.values(guestMap).filter(g => g.expectedMeetingId === meeting.id);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">
          ${d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </h2>
        <button class="modal-close" id="close-detail">✕</button>
      </div>

      <div style="margin-bottom:16px;">
        <div class="text-xs text-muted mb-1">Venue</div>
        <div style="font-size:0.9rem;">${meeting.venue || "—"}</div>
      </div>

      ${meeting.notes ? `
        <div style="margin-bottom:16px;">
          <div class="text-xs text-muted mb-1">Notes</div>
          <div style="font-size:0.9rem;">${meeting.notes}</div>
        </div>
      ` : ""}

      <div style="margin-bottom:16px;">
        <div class="text-xs text-muted mb-1">Expected Guests (${expectedGuests.length})</div>
        ${expectedGuests.length ? expectedGuests.map(g => `
          <div style="font-size:0.875rem;padding:6px 0;border-bottom:1px solid rgba(30,54,102,0.4);">
            ${g.name} · <span style="color:var(--text-muted)">${g.referredByName || "—"}</span>
            ${g.feePaid ? " · <span style='color:var(--status-converted)'>Fee ✓</span>" : ""}
          </div>
        `).join("") : `<p class="text-muted text-sm">None registered</p>`}
      </div>

      <div>
        <div class="text-xs text-muted mb-1">Attended (${attendees.length})</div>
        ${attendees.length ? attendees.map(g => `
          <div style="font-size:0.875rem;padding:6px 0;border-bottom:1px solid rgba(30,54,102,0.4);">
            ${g.name} · <span style="color:var(--status-converted)">✓ Present</span>
          </div>
        `).join("") : `<p class="text-muted text-sm">No attendance marked yet</p>`}
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="edit-meeting-btn">${t("edit")}</button>
        <button class="btn btn-primary" onclick="window.location.hash='attendance'">
          ${t("markAttendance")}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("#close-detail").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("#edit-meeting-btn").addEventListener("click", () => {
    overlay.remove();
    showMeetingModal(meeting);
  });
}

// ── Add/Edit Meeting Modal ────────────────────────────────────
function showMeetingModal(existing = null) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const dateVal = existing?.date
    ? (existing.date?.toDate ? existing.date.toDate() : new Date(existing.date)).toISOString().split("T")[0]
    : "";

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${existing ? t("edit") : t("addMeeting")}</h2>
        <button class="modal-close" id="close-meeting-modal">✕</button>
      </div>

      <div class="form-group">
        <label class="form-label">${t("meetingDate")} <span class="required">*</span></label>
        <input type="date" id="m-date" class="form-control" value="${dateVal}">
      </div>
      <div class="form-group">
        <label class="form-label">${t("meetingVenue")}</label>
        <input type="text" id="m-venue" class="form-control" value="${existing?.venue || ""}">
      </div>
      <div class="form-group">
        <label class="form-label">${t("meetingNotes")}</label>
        <textarea id="m-notes" class="form-control">${existing?.notes || ""}</textarea>
      </div>

      <div id="m-err" class="form-error hidden" style="margin-bottom:8px;"></div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="m-cancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="m-save">${t("save")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("#close-meeting-modal").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#m-cancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#m-save").addEventListener("click", async () => {
    const dateStr = overlay.querySelector("#m-date").value;
    const errEl = overlay.querySelector("#m-err");

    if (!dateStr) {
      errEl.textContent = t("required");
      errEl.classList.remove("hidden");
      return;
    }

    const btn = overlay.querySelector("#m-save");
    btn.disabled = true;

    try {
      const data = {
        chapterId: currentChapterId,
        date: new Date(dateStr),
        venue: overlay.querySelector("#m-venue").value.trim(),
        notes: overlay.querySelector("#m-notes").value.trim(),
      };

      if (existing) {
        await updateMeeting(existing.id, data);
      } else {
        await createMeeting(data);
      }

      showToast(t("success"), "success");
      overlay.remove();
      meetings = await getMeetings(currentChapterId);
      const container = document.getElementById("page-content");
      const chapters = appState.profile?.role === "superAdmin"
        ? await getChapters()
        : await getChaptersByAdmin(appState.profile.uid);
      renderMeetings(container, chapters, meetings);
    } catch (err) {
      errEl.textContent = t("error") + ": " + err.message;
      errEl.classList.remove("hidden");
      btn.disabled = false;
    }
  });
}
