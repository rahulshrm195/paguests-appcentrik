// ============================================================
// pages/attendance.js — Meeting Attendance Marking
// ============================================================

import { appState, showToast } from "../app.js";
import {
  getChapters, getChaptersByAdmin, getMeetings,
  getGuests, markGuestAttendance, getMeeting
} from "../firebase.js";
import { t } from "../i18n.js";

let currentChapterId = null;
let selectedMeetingId = null;
let guests = [];
let meeting = null;

export default async function initAttendance(container) {
  const profile = appState.profile;
  const role = profile?.role;

  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    let chapters;
    if (role === "superAdmin") {
      chapters = await getChapters();
    } else {
      chapters = await getChaptersByAdmin(appState.user?.uid || profile?.id);
    }

    currentChapterId = appState.currentChapterId || chapters[0]?.id;
    if (!currentChapterId) {
      container.innerHTML = `<div class="empty-state"><p>No chapter assigned.</p></div>`;
      return;
    }

    const meetings = await getMeetings(currentChapterId);
    // Default to nearest upcoming or latest
    const now = new Date();
    const upcoming = meetings.filter(m => {
      const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
      return d >= now;
    });
    selectedMeetingId = upcoming[0]?.id || meetings[0]?.id || null;

    if (selectedMeetingId) {
      [guests, meeting] = await Promise.all([
        getGuests(currentChapterId),
        getMeeting(selectedMeetingId),
      ]);
    }

    renderAttendance(container, chapters, meetings);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>${err.message}</p></div>`;
  }
}

function renderAttendance(container, chapters, meetings) {
  const guestsForMeeting = guests.filter(g =>
    g.expectedMeetingId === selectedMeetingId ||
    (meeting?.attendees || []).includes(g.id) ||
    g.status === "Attending" || g.status === "Interested" || g.status === "New"
  );

  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">${t("attendancePage")}</h1>
          <div class="page-subtitle">${meeting ? formatMeetingLabel(meeting) : "Select a meeting"}</div>
        </div>
        <div id="save-indicator" class="hidden" style="font-size:0.8rem;color:var(--status-converted);">✓ ${t("attendanceSaved")}</div>
      </div>

      <!-- Controls -->
      <div class="card" style="margin-bottom:16px;">
        ${chapters.length > 1 ? `
          <div class="form-group">
            <label class="form-label">${t("chapter")}</label>
            <select id="chapter-sel" class="form-control">
              ${chapters.map(ch => `<option value="${ch.id}" ${ch.id === currentChapterId ? "selected" : ""}>${ch.name}</option>`).join("")}
            </select>
          </div>
        ` : ""}

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">${t("selectMeeting")}</label>
          <select id="meeting-sel" class="form-control">
            ${meetings.length === 0 ? `<option value="">No meetings found</option>` :
              meetings.map(m => `
                <option value="${m.id}" ${m.id === selectedMeetingId ? "selected" : ""}>
                  ${formatMeetingLabel(m)}
                </option>
              `).join("")
            }
          </select>
        </div>
      </div>

      <!-- Guests list -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">${t("guestList")}</span>
          <span style="font-size:0.8rem;color:var(--text-muted);">
            ${(meeting?.attendees || []).length} / ${guestsForMeeting.length} ${t("markPresent").toLowerCase()}
          </span>
        </div>

        <div id="attendance-list">
          ${renderAttendanceList(guestsForMeeting, meeting)}
        </div>
      </div>
    </div>
  `;

  // Chapter switch
  container.querySelector("#chapter-sel")?.addEventListener("change", async (e) => {
    currentChapterId = e.target.value;
    appState.currentChapterId = currentChapterId;
    const [newMeetings, newGuests] = await Promise.all([
      getMeetings(currentChapterId),
      getGuests(currentChapterId),
    ]);
    guests = newGuests;
    const now = new Date();
    const upcoming = newMeetings.filter(m => {
      const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
      return d >= now;
    });
    selectedMeetingId = upcoming[0]?.id || newMeetings[0]?.id || null;
    meeting = selectedMeetingId ? await getMeeting(selectedMeetingId) : null;
    renderAttendance(container, chapters, newMeetings);
  });

  // Meeting switch
  container.querySelector("#meeting-sel")?.addEventListener("change", async (e) => {
    selectedMeetingId = e.target.value;
    meeting = selectedMeetingId ? await getMeeting(selectedMeetingId) : null;
    const guestsForMeeting = guests.filter(g =>
      g.expectedMeetingId === selectedMeetingId ||
      (meeting?.attendees || []).includes(g.id) ||
      g.status === "Attending" || g.status === "Interested" || g.status === "New"
    );
    document.getElementById("attendance-list").innerHTML = renderAttendanceList(guestsForMeeting, meeting);
    document.querySelector(".page-subtitle").textContent = meeting ? formatMeetingLabel(meeting) : "Select a meeting";
    bindToggleEvents();
  });

  bindToggleEvents();
}

function renderAttendanceList(guestsForMeeting, meeting) {
  if (!meeting || guestsForMeeting.length === 0) {
    return `
      <div class="empty-state" style="padding:24px;">
        <span class="empty-state-icon" style="font-size:2rem;">👥</span>
        <p>${t("noGuestsForMeeting")}</p>
      </div>
    `;
  }

  return guestsForMeeting.map(g => {
    const isPresent = (meeting.attendees || []).includes(g.id);
    return `
      <div class="attendance-item ${isPresent ? "present" : ""}" id="att-${g.id}">
        <div>
          <div style="font-weight:600;font-size:0.875rem;">${g.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">
            ${g.businessName || g.businessType || "—"} ·
            ${t("referredByName").split("(")[0].trim()}: ${g.referredByName || "—"}
            ${g.feePaid ? " · <span style='color:var(--status-converted)'>Fee ✓</span>" : ""}
          </div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="attendance-toggle-input" data-guest-id="${g.id}" ${isPresent ? "checked" : ""}>
          <span class="toggle-track"></span>
        </label>
      </div>
    `;
  }).join("");
}

function bindToggleEvents() {
  document.querySelectorAll(".attendance-toggle-input").forEach(toggle => {
    toggle.addEventListener("change", async (e) => {
      const guestId = e.target.dataset.guestId;
      const present = e.target.checked;
      const item = document.getElementById(`att-${guestId}`);

      try {
        await markGuestAttendance(selectedMeetingId, guestId, present);
        item.classList.toggle("present", present);

        // Refresh meeting data
        meeting = await getMeeting(selectedMeetingId);

        // Update counter
        const counter = document.querySelector(".card-header span[style]");
        const allGuests = document.querySelectorAll(".attendance-toggle-input");
        const presentCount = document.querySelectorAll(".attendance-toggle-input:checked").length;
        if (counter) {
          counter.textContent = `${presentCount} / ${allGuests.length} ${t("markPresent").toLowerCase()}`;
        }

        // Show save indicator
        const indicator = document.getElementById("save-indicator");
        if (indicator) {
          indicator.classList.remove("hidden");
          setTimeout(() => indicator.classList.add("hidden"), 2000);
        }
      } catch (err) {
        showToast(t("error") + ": " + err.message, "error");
        e.target.checked = !present; // revert
      }
    });
  });
}

function formatMeetingLabel(m) {
  if (!m) return "";
  const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    (m.venue ? ` · ${m.venue}` : "");
}
