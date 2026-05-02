// ============================================================
// pages/guest-detail.js — Guest Profile, Followups, Status
// ============================================================

import { appState, statusBadge, formatDate, showToast, routeTo } from "../app.js";
import {
  getGuest, updateGuest, deleteGuest,
  getFollowups, addFollowup, getMeeting, getMeetings
} from "../firebase.js";
import { t } from "../i18n.js";

export default async function initGuestDetail(container, params) {
  // Get guestId from params or hash
  let guestId = params?.guestId;
  if (!guestId) {
    const hash = window.location.hash.replace("#", "");
    const parts = hash.split("/");
    guestId = parts[1];
  }

  if (!guestId) {
    container.innerHTML = `<div class="empty-state"><p>Guest not found.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    const [guest, followups] = await Promise.all([
      getGuest(guestId),
      getFollowups(guestId),
    ]);

    if (!guest) {
      container.innerHTML = `<div class="empty-state"><p>Guest not found.</p></div>`;
      return;
    }

    // Load meeting names
    const meetingLabels = {};
    if (guest.meetingsAttended?.length) {
      const allMeetings = await getMeetings(guest.chapterId);
      allMeetings.forEach(m => {
        const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
        meetingLabels[m.id] = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + (m.venue ? ` · ${m.venue}` : "");
      });
    }

    renderGuestDetail(container, guest, followups, meetingLabels, guestId);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>${err.message}</p></div>`;
  }
}

function renderGuestDetail(container, guest, followups, meetingLabels, guestId) {
  const profile = appState.profile;
  const canEdit = profile?.role === "superAdmin" || profile?.role === "chapterAdmin";

  container.innerHTML = `
    <div class="fade-in">
      <!-- Back + Actions -->
      <div class="page-header">
        <div class="flex items-center gap-2">
          <button class="btn btn-ghost btn-sm" id="back-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            ${t("back")}
          </button>
        </div>
        ${canEdit ? `
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" id="edit-guest-btn">${t("edit")}</button>
            <button class="btn btn-danger btn-sm" id="delete-guest-btn">${t("delete")}</button>
          </div>
        ` : ""}
      </div>

      <!-- Guest Profile Card -->
      <div class="card" style="margin-bottom:16px;">
        <div class="flex items-center gap-3" style="margin-bottom:16px;">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--gold-dim);border:2px solid var(--gold-border);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:1.4rem;color:var(--gold);font-weight:700;flex-shrink:0;">
            ${(guest.name || "G")[0].toUpperCase()}
          </div>
          <div style="flex:1;">
            <h2 style="font-family:var(--font-display);font-size:1.3rem;">${guest.name}</h2>
            <div style="font-size:0.8rem;color:var(--text-muted);">${guest.phone}</div>
          </div>
          ${statusBadge(guest.status)}
        </div>

        <div class="grid-2" style="gap:16px;">
          <div>
            <div class="text-xs text-muted" style="margin-bottom:2px;">${t("businessName")}</div>
            <div style="font-size:0.875rem;">${guest.businessName || "—"}</div>
          </div>
          <div>
            <div class="text-xs text-muted" style="margin-bottom:2px;">${t("businessType")}</div>
            <div style="font-size:0.875rem;">${guest.businessType || "—"}</div>
          </div>
          <div>
            <div class="text-xs text-muted" style="margin-bottom:2px;">${t("referredByName")}</div>
            <div style="font-size:0.875rem;">${guest.referredByName || "—"}</div>
          </div>
          <div>
            <div class="text-xs text-muted" style="margin-bottom:2px;">${t("referredByPhone")}</div>
            <div style="font-size:0.875rem;">${guest.referredByPhone || "—"}</div>
          </div>
          <div>
            <div class="text-xs text-muted" style="margin-bottom:2px;">${t("feePaid")}</div>
            <div style="font-size:0.875rem;color:${guest.feePaid ? "var(--status-converted)" : "var(--text-muted)"};">
              ${guest.feePaid ? "✓ " + t("yes") : t("no")}
            </div>
          </div>
          <div>
            <div class="text-xs text-muted" style="margin-bottom:2px;">Registered</div>
            <div style="font-size:0.875rem;">${formatDate(guest.createdAt)}</div>
          </div>
        </div>

        ${canEdit ? `
          <!-- Status Update -->
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--navy-border);">
            <div class="text-xs text-muted" style="margin-bottom:8px;">${t("updateStatus")}</div>
            <div class="flex gap-2" style="flex-wrap:wrap;">
              ${["New","Attending","Interested","Converted","NotInterested","Ghosted"].map(s => `
                <button class="filter-chip ${guest.status === s ? "active" : ""} status-update-btn" data-status="${s}">
                  ${t("status" + s)}
                </button>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>

      <!-- Meetings Attended -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <span class="card-title">📅 ${t("meetingsAttended")}</span>
          <span style="font-size:0.8rem;color:var(--text-muted);">${guest.meetingsAttended?.length || 0} total</span>
        </div>
        ${!guest.meetingsAttended?.length ? `
          <p class="text-muted text-sm">${t("noMeetingsAttended")}</p>
        ` : guest.meetingsAttended.map(mId => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,54,102,0.4);">
            <svg width="14" height="14" fill="none" stroke="var(--gold)" stroke-width="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style="font-size:0.875rem;">${meetingLabels[mId] || mId}</span>
          </div>
        `).join("")}
      </div>

      <!-- Follow-up Log -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">💬 ${t("followUpLog")}</span>
          ${canEdit ? `<button class="btn btn-primary btn-sm" id="add-followup-btn">+ ${t("addFollowUp")}</button>` : ""}
        </div>

        <div id="followup-area">
          ${renderFollowups(followups)}
        </div>
      </div>
    </div>
  `;

  // Back
  container.querySelector("#back-btn").addEventListener("click", () => {
    window.location.hash = "guests";
    routeTo("guests");
  });

  // Edit
  container.querySelector("#edit-guest-btn")?.addEventListener("click", () => {
    showEditModal(guest, guestId, container);
  });

  // Delete
  container.querySelector("#delete-guest-btn")?.addEventListener("click", async () => {
    if (!confirm(t("confirmDelete"))) return;
    await deleteGuest(guestId);
    showToast("Guest deleted", "success");
    window.location.hash = "guests";
    routeTo("guests");
  });

  // Status update
  container.querySelectorAll(".status-update-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const newStatus = btn.dataset.status;
      await updateGuest(guestId, { status: newStatus });
      showToast(t("success"), "success");
      // Refresh
      initGuestDetail(container, { guestId });
    });
  });

  // Add follow-up
  container.querySelector("#add-followup-btn")?.addEventListener("click", () => {
    showFollowupModal(guestId, guest.chapterId, async () => {
      const updated = await getFollowups(guestId);
      document.getElementById("followup-area").innerHTML = renderFollowups(updated);
    });
  });
}

function renderFollowups(followups) {
  if (!followups.length) {
    return `<p class="text-muted text-sm">${t("noFollowUps")}</p>`;
  }

  return `
    <div class="followup-timeline">
      ${followups.map(f => `
        <div class="followup-item">
          <div class="followup-date">${formatDate(f.createdAt)}</div>
          <div class="followup-notes">${f.notes || "—"}</div>
          <div class="followup-by">${t("followUpBy")}: ${f.byWhom || "—"}${f.outcome ? " · " + f.outcome : ""}</div>
        </div>
      `).join("")}
    </div>
  `;
}

// ── Edit Modal ────────────────────────────────────────────────
async function showEditModal(guest, guestId, container) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${t("editGuest")}</h2>
        <button class="modal-close" id="close-edit">✕</button>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t("guestName")} <span class="required">*</span></label>
          <input id="e-name" class="form-control" value="${guest.name || ""}">
        </div>
        <div class="form-group">
          <label class="form-label">${t("guestPhone")} <span class="required">*</span></label>
          <input id="e-phone" class="form-control" value="${guest.phone || ""}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t("businessName")}</label>
          <input id="e-bname" class="form-control" value="${guest.businessName || ""}">
        </div>
        <div class="form-group">
          <label class="form-label">${t("businessType")}</label>
          <select id="e-btype" class="form-control">
            <option value="">— Select —</option>
            ${t("businessTypes").map(b => `<option value="${b}" ${guest.businessType === b ? "selected" : ""}>${b}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t("referredByName")}</label>
          <input id="e-refname" class="form-control" value="${guest.referredByName || ""}">
        </div>
        <div class="form-group">
          <label class="form-label">${t("referredByPhone")}</label>
          <input id="e-refphone" class="form-control" value="${guest.referredByPhone || ""}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">${t("feePaid")}</label>
        <div class="radio-group">
          <label class="radio-option ${guest.feePaid ? "selected" : ""}" id="e-fee-yes-label">
            <input type="radio" name="e-feePaid" id="e-fee-yes" value="yes" ${guest.feePaid ? "checked" : ""}>
            <span>${t("feePaidYes")}</span>
          </label>
          <label class="radio-option ${!guest.feePaid ? "selected" : ""}" id="e-fee-no-label">
            <input type="radio" name="e-feePaid" id="e-fee-no" value="no" ${!guest.feePaid ? "checked" : ""}>
            <span>${t("feePaidNo")}</span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="e-cancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="e-save">${t("save")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('input[name="e-feePaid"]').forEach(r => {
    r.addEventListener("change", () => {
      overlay.querySelector("#e-fee-yes-label").classList.toggle("selected", overlay.querySelector("#e-fee-yes").checked);
      overlay.querySelector("#e-fee-no-label").classList.toggle("selected", overlay.querySelector("#e-fee-no").checked);
    });
  });

  overlay.querySelector("#close-edit").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#e-cancel").addEventListener("click", () => overlay.remove());

  overlay.querySelector("#e-save").addEventListener("click", async () => {
    const name = overlay.querySelector("#e-name").value.trim();
    const phone = overlay.querySelector("#e-phone").value.trim();
    if (!name || !phone) return;

    try {
      await updateGuest(guestId, {
        name,
        phone,
        businessName: overlay.querySelector("#e-bname").value.trim(),
        businessType: overlay.querySelector("#e-btype").value,
        referredByName: overlay.querySelector("#e-refname").value.trim(),
        referredByPhone: overlay.querySelector("#e-refphone").value.trim(),
        feePaid: overlay.querySelector("#e-fee-yes").checked,
      });
      showToast(t("success"), "success");
      overlay.remove();
      initGuestDetail(container, { guestId });
    } catch (err) {
      showToast(t("error") + ": " + err.message, "error");
    }
  });
}

// ── Follow-up Modal ───────────────────────────────────────────
function showFollowupModal(guestId, chapterId, onSaved) {
  const today = new Date().toISOString().split("T")[0];
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${t("addFollowUp")}</h2>
        <button class="modal-close" id="close-fu">✕</button>
      </div>

      <div class="form-group">
        <label class="form-label">${t("followUpDate")}</label>
        <input type="date" id="fu-date" class="form-control" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">${t("followUpBy")} <span class="required">*</span></label>
        <input id="fu-by" class="form-control" placeholder="${t("followUpBy")}">
      </div>
      <div class="form-group">
        <label class="form-label">${t("followUpNotes")}</label>
        <textarea id="fu-notes" class="form-control" placeholder="${t("followUpNotes")}"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">${t("followUpOutcome")}</label>
        <select id="fu-outcome" class="form-control">
          <option value="">— Select —</option>
          ${t("outcomes").map(o => `<option value="${o}">${o}</option>`).join("")}
        </select>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="fu-cancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="fu-save">${t("save")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("#close-fu").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#fu-cancel").addEventListener("click", () => overlay.remove());

  overlay.querySelector("#fu-save").addEventListener("click", async () => {
    const byWhom = overlay.querySelector("#fu-by").value.trim();
    if (!byWhom) return;

    try {
      await addFollowup({
        guestId,
        chapterId,
        date: overlay.querySelector("#fu-date").value,
        byWhom,
        notes: overlay.querySelector("#fu-notes").value.trim(),
        outcome: overlay.querySelector("#fu-outcome").value,
      });
      showToast(t("success"), "success");
      overlay.remove();
      if (onSaved) onSaved();
    } catch (err) {
      showToast(t("error") + ": " + err.message, "error");
    }
  });
}
