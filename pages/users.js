// ============================================================
// pages/users.js — User Management (Super Admin)
// Note: Firebase Auth user creation requires Admin SDK (backend).
// This page manages Firestore user profiles.
// For creating new auth users, use Firebase console or a Cloud Function.
// ============================================================

import { showToast } from "../app.js";
import { getUsers, updateUserProfile, getChapters } from "../firebase.js";
import { t } from "../i18n.js";

let users = [];
let chapters = [];

export default async function initUsers(container) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    [users, chapters] = await Promise.all([getUsers(), getChapters()]);
    renderUsers(container);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>${err.message}</p></div>`;
  }
}

function renderUsers(container) {
  const roleColors = {
    superAdmin: "var(--gold)",
    chapterAdmin: "var(--status-interested)",
    desk: "var(--status-attending)",
  };

  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">${t("usersList")}</h1>
          <div class="page-subtitle">${users.length} users</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" id="refresh-btn">↻ Refresh</button>
          <button class="btn btn-primary" id="info-btn">ℹ️ How to add users</button>
        </div>
      </div>

      <!-- Info banner -->
      <div class="card" style="margin-bottom:16px;background:var(--info-dim);border-color:rgba(82,149,224,0.3);">
        <div style="font-size:0.85rem;color:var(--info);">
          <strong>Note:</strong> To create a new user, first create their account in Firebase Authentication console,
          then use the "Edit" button below to assign their role and chapters. The UID from Firebase Auth becomes their profile.
        </div>
      </div>

      ${users.length === 0 ? `
        <div class="empty-state">
          <span class="empty-state-icon">👤</span>
          <p>${t("noUsers")}</p>
        </div>
      ` : users.map(u => {
        const roleLabel = {
          superAdmin: t("roleSuperAdmin"),
          chapterAdmin: t("roleChapterAdmin"),
          desk: t("roleDesk"),
        }[u.role] || u.role;

        const userChapters = (u.chapterIds || [])
          .map(id => chapters.find(c => c.id === id)?.name)
          .filter(Boolean)
          .join(", ");

        const initials = (u.name || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

        return `
          <div class="card" style="margin-bottom:10px;">
            <div class="flex items-center gap-3">
              <div style="width:40px;height:40px;border-radius:50%;background:var(--gold-dim);border:1.5px solid var(--gold-border);display:flex;align-items:center;justify-content:center;color:var(--gold);font-weight:700;font-size:0.85rem;flex-shrink:0;">
                ${initials}
              </div>
              <div style="flex:1;">
                <div style="font-weight:600;">${u.name || "—"}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${u.email || "—"}</div>
                <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                  <span style="font-size:0.7rem;padding:2px 8px;border-radius:20px;background:rgba(0,0,0,0.2);color:${roleColors[u.role] || "var(--text-muted)"};">
                    ${roleLabel}
                  </span>
                  ${userChapters ? `<span style="font-size:0.72rem;color:var(--text-muted);">${userChapters}</span>` : ""}
                </div>
              </div>
              <button class="btn btn-ghost btn-sm edit-user-btn" data-id="${u.id}">
                ${t("edit")}
              </button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  container.querySelector("#refresh-btn")?.addEventListener("click", async () => {
    users = await getUsers();
    renderUsers(container);
  });

  container.querySelector("#info-btn")?.addEventListener("click", () => {
    showInfoModal();
  });

  container.querySelectorAll(".edit-user-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const user = users.find(u => u.id === btn.dataset.id);
      if (user) showEditUserModal(user, container);
    });
  });
}

function showInfoModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">How to add new users</h2>
        <button class="modal-close" id="close-info">✕</button>
      </div>
      <div style="font-size:0.875rem;line-height:1.8;color:var(--text-secondary);">
        <p style="margin-bottom:12px;"><strong style="color:var(--gold);">Step 1:</strong> Go to Firebase Console → Authentication → Add user</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--gold);">Step 2:</strong> Enter their email and set a password</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--gold);">Step 3:</strong> Copy the UID shown in Firebase</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--gold);">Step 4:</strong> In Firestore, create a document in <code style="background:var(--navy);padding:2px 6px;border-radius:4px;">users/{uid}</code> with fields: name, email, role, chapterIds</p>
        <p><strong style="color:var(--gold);">Step 5:</strong> The user can then log in and use the app</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="close-info-btn">Got it</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("#close-info").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#close-info-btn").addEventListener("click", () => overlay.remove());
}

function showEditUserModal(user, container) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${t("edit")}: ${user.name || user.email}</h2>
        <button class="modal-close" id="close-eu">✕</button>
      </div>

      <div class="form-group">
        <label class="form-label">${t("userName")}</label>
        <input id="eu-name" class="form-control" value="${user.name || ""}">
      </div>

      <div class="form-group">
        <label class="form-label">${t("userRole")}</label>
        <select id="eu-role" class="form-control">
          <option value="superAdmin" ${user.role === "superAdmin" ? "selected" : ""}>${t("roleSuperAdmin")}</option>
          <option value="chapterAdmin" ${user.role === "chapterAdmin" ? "selected" : ""}>${t("roleChapterAdmin")}</option>
          <option value="desk" ${user.role === "desk" ? "selected" : ""}>${t("roleDesk")}</option>
        </select>
      </div>

      <div class="form-group" id="chapters-group" ${user.role === "superAdmin" ? "style='display:none;'" : ""}>
        <label class="form-label">${t("userChapters")}</label>
        <div style="max-height:200px;overflow-y:auto;background:var(--navy);border:1px solid var(--navy-border);border-radius:var(--radius-sm);padding:8px;">
          ${chapters.map(ch => `
            <label style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-radius:4px;">
              <input type="checkbox" class="eu-chapter-check" value="${ch.id}" ${(user.chapterIds || []).includes(ch.id) ? "checked" : ""}>
              <span style="font-size:0.875rem;">${ch.name}${ch.city ? ` — ${ch.city}` : ""}</span>
            </label>
          `).join("")}
        </div>
      </div>

      <div id="eu-err" class="form-error hidden" style="margin-bottom:8px;"></div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="eu-cancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="eu-save">${t("save")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Show/hide chapters based on role
  overlay.querySelector("#eu-role").addEventListener("change", (e) => {
    const chaptersGroup = overlay.querySelector("#chapters-group");
    chaptersGroup.style.display = e.target.value === "superAdmin" ? "none" : "block";
  });

  overlay.querySelector("#close-eu").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#eu-cancel").addEventListener("click", () => overlay.remove());

  overlay.querySelector("#eu-save").addEventListener("click", async () => {
    const role = overlay.querySelector("#eu-role").value;
    const name = overlay.querySelector("#eu-name").value.trim();
    const chapterIds = [...overlay.querySelectorAll(".eu-chapter-check:checked")].map(c => c.value);
    const errEl = overlay.querySelector("#eu-err");

    try {
      await updateUserProfile(user.id, {
        name,
        role,
        chapterIds: role === "superAdmin" ? [] : chapterIds,
      });
      showToast(t("success"), "success");
      overlay.remove();
      users = await getUsers();
      renderUsers(container);
    } catch (err) {
      errEl.textContent = t("error") + ": " + err.message;
      errEl.classList.remove("hidden");
    }
  });
}
