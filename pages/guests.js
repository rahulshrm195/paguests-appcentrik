// ============================================================
// pages/guests.js — Guest List + Add Guest
// ============================================================

import { appState, statusBadge, formatDate, routeTo, showToast } from "../app.js";
import {
  getGuests, getAllGuests, getChapters, getChaptersByAdmin,
  updateGuest, deleteGuest, registerGuestPublic,
  getUpcomingMeetings
} from "../firebase.js";
import { t } from "../i18n.js";

let allGuests = [];
let filteredGuests = [];
let activeFilter = "all";
let searchQuery = "";
let currentChapterId = null;
let chapters = [];
let selectedChapterId = null; // for super admin

export default async function initGuests(container) {
  const profile = appState.profile;
  const role = profile?.role;

  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    if (role === "superAdmin") {
      chapters = await getChapters();
      selectedChapterId = chapters[0]?.id || null;
      allGuests = selectedChapterId ? await getGuests(selectedChapterId) : [];
    } else {
      chapters = await getChaptersByAdmin(appState.user?.uid || profile?.id);
      currentChapterId = appState.currentChapterId || chapters[0]?.id;
      appState.currentChapterId = currentChapterId;
      allGuests = currentChapterId ? await getGuests(currentChapterId) : [];
    }

    renderGuestList(container);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>${err.message}</p></div>`;
  }
}

function renderGuestList(container) {
  const profile = appState.profile;
  const role = profile?.role;

  filteredGuests = applyFilters(allGuests);

  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">${t("guests")}</h1>
          <div class="page-subtitle">${filteredGuests.length} ${t("guests").toLowerCase()}</div>
        </div>
        <button class="btn btn-primary" id="add-guest-btn">
          + ${t("addGuest")}
        </button>
      </div>

      ${role === "superAdmin" && chapters.length > 0 ? `
        <div style="margin-bottom:16px;">
          <select id="chapter-filter-sel" class="form-control" style="max-width:260px;">
            ${chapters.map(ch => `<option value="${ch.id}" ${ch.id === selectedChapterId ? "selected" : ""}>${ch.name}${ch.city ? " — " + ch.city : ""}</option>`).join("")}
          </select>
        </div>
      ` : ""}

      ${chapters.length > 1 && role !== "superAdmin" ? `
        <div style="margin-bottom:16px;">
          <select id="chapter-switcher" class="form-control" style="max-width:260px;">
            ${chapters.map(ch => `<option value="${ch.id}" ${ch.id === currentChapterId ? "selected" : ""}>${ch.name}</option>`).join("")}
          </select>
        </div>
      ` : ""}

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input">
          <svg class="search-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="guest-search" class="form-control" placeholder="${t("search")}..." value="${searchQuery}">
        </div>
        ${["all","New","Attending","Interested","Converted","NotInterested","Ghosted"].map(f => `
          <span class="filter-chip ${activeFilter === f ? "active" : ""}" data-filter="${f}">
            ${f === "all" ? t("all") : t("status" + f.replace("N","N"))}
          </span>
        `).join("")}
      </div>

      <!-- Guest List -->
      <div id="guest-list-area">
        ${renderGuestCards(filteredGuests)}
      </div>
    </div>
  `;

  bindGuestListEvents(container);
}

function renderGuestCards(guests) {
  if (guests.length === 0) {
    return `
      <div class="empty-state">
        <span class="empty-state-icon">👥</span>
        <p>${t("noData")}</p>
        <button class="btn btn-primary" id="empty-add-btn">+ ${t("addGuest")}</button>
      </div>
    `;
  }

  return guests.map((g) => `
    <div class="guest-item" data-guest-id="${g.id}">
      <div class="guest-avatar">${(g.name || "G")[0].toUpperCase()}</div>
      <div class="guest-info">
        <div class="guest-name">${g.name}</div>
        <div class="guest-meta">
          ${g.businessName || g.businessType || "—"} ·
          ${t("referredByName").split("(")[0].trim()}: ${g.referredByName || "—"}
          ${g.feePaid ? " · <span style='color:var(--status-converted)'>Fee ✓</span>" : ""}
          ${g.meetingsAttended?.length ? ` · ${g.meetingsAttended.length} meeting(s)` : ""}
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${statusBadge(g.status)}
        <button class="btn btn-ghost btn-sm view-guest-btn" data-id="${g.id}" style="padding:6px 8px;">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </div>
  `).join("");
}

function bindGuestListEvents(container) {
  // Add guest
  container.querySelector("#add-guest-btn")?.addEventListener("click", () => showAddGuestModal());
  container.querySelector("#empty-add-btn")?.addEventListener("click", () => showAddGuestModal());

  // Search
  container.querySelector("#guest-search")?.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    updateList();
  });

  // Filter chips
  container.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeFilter = chip.dataset.filter;
      container.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      updateList();
    });
  });

  // View guest
  container.querySelector("#guest-list-area")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-guest-btn");
    const item = e.target.closest(".guest-item");
    if (btn) {
      routeTo("guest-detail", { guestId: btn.dataset.id });
      window.location.hash = `guest-detail/${btn.dataset.id}`;
    } else if (item) {
      const id = item.dataset.guestId;
      if (id) {
        routeTo("guest-detail", { guestId: id });
        window.location.hash = `guest-detail/${id}`;
      }
    }
  });

  // Chapter selectors
  container.querySelector("#chapter-filter-sel")?.addEventListener("change", async (e) => {
    selectedChapterId = e.target.value;
    allGuests = await getGuests(selectedChapterId);
    updateList();
  });

  container.querySelector("#chapter-switcher")?.addEventListener("change", async (e) => {
    currentChapterId = e.target.value;
    appState.currentChapterId = currentChapterId;
    allGuests = await getGuests(currentChapterId);
    updateList();
  });
}

function applyFilters(guests) {
  let list = [...guests];
  if (activeFilter !== "all") list = list.filter(g => g.status === activeFilter);
  if (searchQuery) {
    list = list.filter(g =>
      g.name?.toLowerCase().includes(searchQuery) ||
      g.phone?.includes(searchQuery) ||
      g.businessName?.toLowerCase().includes(searchQuery) ||
      g.referredByName?.toLowerCase().includes(searchQuery)
    );
  }
  return list;
}

function updateList() {
  filteredGuests = applyFilters(allGuests);
  document.getElementById("guest-list-area").innerHTML = renderGuestCards(filteredGuests);
  document.querySelector(".page-subtitle").textContent = `${filteredGuests.length} ${t("guests").toLowerCase()}`;

  // Rebind view buttons
  document.getElementById("guest-list-area")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-guest-btn");
    const item = e.target.closest(".guest-item");
    if (btn) {
      routeTo("guest-detail", { guestId: btn.dataset.id });
    } else if (item?.dataset.guestId) {
      routeTo("guest-detail", { guestId: item.dataset.guestId });
    }
  });
}

// ── Add Guest Modal ───────────────────────────────────────────
async function showAddGuestModal() {
  const chapterId = appState.profile.role === "superAdmin" ? selectedChapterId : currentChapterId;
  if (!chapterId) { showToast("Select a chapter first", "error"); return; }

  const meetings = await getUpcomingMeetings(chapterId);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog">
      <div class="modal-header">
        <h2 class="modal-title">${t("addGuest")}</h2>
        <button class="modal-close" id="close-modal">✕</button>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t("guestName")} <span class="required">*</span></label>
          <input type="text" id="m-name" class="form-control" placeholder="${t("guestName")}">
        </div>
        <div class="form-group">
          <label class="form-label">${t("guestPhone")} <span class="required">*</span></label>
          <input type="tel" id="m-phone" class="form-control" placeholder="${t("guestPhone")}" maxlength="15">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t("businessName")}</label>
          <input type="text" id="m-bname" class="form-control" placeholder="${t("businessName")}">
        </div>
        <div class="form-group">
          <label class="form-label">${t("businessType")}</label>
          <select id="m-btype" class="form-control">
            <option value="">— Select —</option>
            ${t("businessTypes").map(b => `<option value="${b}">${b}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t("referredByName")} <span class="required">*</span></label>
          <input type="text" id="m-refname" class="form-control" placeholder="${t("referredByName")}">
        </div>
        <div class="form-group">
          <label class="form-label">${t("referredByPhone")} <span class="required">*</span></label>
          <input type="tel" id="m-refphone" class="form-control" placeholder="${t("referredByPhone")}" maxlength="15">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">${t("expectedMeeting")}</label>
        <select id="m-meeting" class="form-control">
          <option value="">${t("notDecided")}</option>
          ${meetings.map(m => {
            const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
            return `<option value="${m.id}">${d.toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"})}${m.venue ? " · " + m.venue : ""}</option>`;
          }).join("")}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">${t("feePaid")}</label>
        <div class="radio-group">
          <label class="radio-option" id="m-fee-yes-label">
            <input type="radio" name="m-feePaid" value="yes" id="m-fee-yes">
            <span>${t("feePaidYes")}</span>
          </label>
          <label class="radio-option selected" id="m-fee-no-label">
            <input type="radio" name="m-feePaid" value="no" id="m-fee-no" checked>
            <span>${t("feePaidNo")}</span>
          </label>
        </div>
      </div>

      <div id="m-error" class="form-error hidden" style="margin-bottom:8px;"></div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="m-cancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="m-save">${t("save")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Fee radio
  overlay.querySelectorAll('input[name="m-feePaid"]').forEach(r => {
    r.addEventListener("change", () => {
      overlay.querySelector("#m-fee-yes-label").classList.toggle("selected", overlay.querySelector("#m-fee-yes").checked);
      overlay.querySelector("#m-fee-no-label").classList.toggle("selected", overlay.querySelector("#m-fee-no").checked);
    });
  });

  overlay.querySelector("#close-modal").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#m-cancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#m-save").addEventListener("click", async () => {
    const name = overlay.querySelector("#m-name").value.trim();
    const phone = overlay.querySelector("#m-phone").value.trim();
    const refName = overlay.querySelector("#m-refname").value.trim();
    const refPhone = overlay.querySelector("#m-refphone").value.trim();
    const errEl = overlay.querySelector("#m-error");

    if (!name || !phone || !refName || !refPhone) {
      errEl.textContent = t("required");
      errEl.classList.remove("hidden");
      return;
    }

    const meetingId = overlay.querySelector("#m-meeting").value;
    const feePaid = overlay.querySelector("#m-fee-yes").checked;
    const btn = overlay.querySelector("#m-save");
    btn.disabled = true;

    try {
      await registerGuestPublic({
        chapterId,
        name,
        phone,
        businessName: overlay.querySelector("#m-bname").value.trim(),
        businessType: overlay.querySelector("#m-btype").value,
        referredByName: refName,
        referredByPhone: refPhone,
        expectedMeetingId: meetingId || null,
        meetingDecided: !!meetingId,
        feePaid,
      });

      showToast(t("guestRegistered"), "success");
      overlay.remove();

      // Refresh list
      const updatedChapterId = appState.profile.role === "superAdmin" ? selectedChapterId : currentChapterId;
      allGuests = await getGuests(updatedChapterId);
      updateList();
    } catch (err) {
      errEl.textContent = t("error") + ": " + err.message;
      errEl.classList.remove("hidden");
      btn.disabled = false;
    }
  });
}
