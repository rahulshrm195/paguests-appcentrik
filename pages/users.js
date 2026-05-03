// ============================================================
// pages/users.js — User Management (Super Admin)
// Uses secondary Firebase app instance to create users
// without logging out the current Super Admin session
// ============================================================

import { showToast } from "../app.js";
import { getUsers, updateUserProfile, getChapters, createUserProfile, db } from "../firebase.js";
import {
  initializeApp, getApps
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { t } from "../i18n.js";

let users = [];
let chapters = [];

// Secondary Firebase app instance — creates users without signing out Super Admin
function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === "secondary");
  if (existing) return getAuth(existing);
  const primaryApp = getApps().find(a => a.name === "[DEFAULT]");
  const secondaryApp = initializeApp(primaryApp.options, "secondary");
  return getAuth(secondaryApp);
}

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
          <button class="btn btn-primary" id="add-user-btn">+ ${t("addUser")}</button>
        </div>
      </div>

      ${users.length === 0 ? `
        <div class="empty-state">
          <span class="empty-state-icon">👤</span>
          <p>${t("noUsers")}</p>
          <button class="btn btn-primary" id="empty-add-btn">+ ${t("addUser")}</button>
        </div>
      ` : users.map(u => {
        const roleLabel = {
          superAdmin: t("roleSuperAdmin"),
          chapterAdmin: t("roleChapterAdmin"),
          desk: t("roleDesk"),
        }[u.role] || u.role;

        const userChapters = (u.chapterIds || [])
          .map(id => chapters.find(c => c.id === id)?.name)
          .filter(Boolean).join(", ");

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
              <div class="flex gap-2">
                <button class="btn btn-ghost btn-sm edit-user-btn" data-id="${u.id}">${t("edit")}</button>
                <button class="btn btn-danger btn-sm delete-user-btn" data-id="${u.id}" data-name="${u.name || u.email}">${t("delete")}</button>
              </div>
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
  container.querySelector("#add-user-btn")?.addEventListener("click", () => showCreateUserModal(container));
  container.querySelector("#empty-add-btn")?.addEventListener("click", () => showCreateUserModal(container));
  container.querySelectorAll(".edit-user-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const user = users.find(u => u.id === btn.dataset.id);
      if (user) showEditUserModal(user, container);
    });
  });
  container.querySelectorAll(".delete-user-btn").forEach(btn => {
    btn.addEventListener("click", () => showDeleteConfirm(btn.dataset.id, btn.dataset.name, container));
  });
}

function showCreateUserModal(container) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">+ ${t("addUser")}</h2>
        <button class="modal-close" id="close-cu">✕</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t("userName")} <span class="required">*</span></label>
          <input id="cu-name" class="form-control" placeholder="Full name" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">${t("userRole")} <span class="required">*</span></label>
          <select id="cu-role" class="form-control">
            <option value="chapterAdmin">${t("roleChapterAdmin")}</option>
            <option value="desk">${t("roleDesk")}</option>
            <option value="superAdmin">${t("roleSuperAdmin")}</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t("userEmail")} <span class="required">*</span></label>
        <input id="cu-email" class="form-control" type="email" placeholder="email@example.com" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Password <span class="required">*</span></label>
        <div style="position:relative;">
          <input id="cu-password" class="form-control" type="password" placeholder="Min 6 characters" autocomplete="new-password" style="padding-right:52px;">
          <button id="toggle-pw" type="button" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.75rem;font-weight:600;">SHOW</button>
        </div>
      </div>
      <div class="form-group" id="cu-chapters-group">
        <label class="form-label">${t("userChapters")}</label>
        <div style="max-height:180px;overflow-y:auto;background:var(--navy);border:1px solid var(--navy-border);border-radius:var(--radius-sm);padding:8px;">
          ${chapters.length === 0
            ? `<p class="text-muted text-sm">No chapters yet. Create chapters first.</p>`
            : chapters.map(ch => `
              <label style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-radius:4px;">
                <input type="checkbox" class="cu-chapter-check" value="${ch.id}">
                <span style="font-size:0.875rem;">${ch.name}${ch.city ? ` — ${ch.city}` : ""}</span>
              </label>
            `).join("")}
        </div>
      </div>
      <div id="cu-err" class="form-error hidden" style="margin-bottom:8px;"></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cu-cancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="cu-save">
          <span id="cu-save-label">Create User</span>
          <div id="cu-spinner" class="spinner hidden" style="width:16px;height:16px;border-width:2px;margin-left:6px;"></div>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#cu-role").addEventListener("change", e => {
    overlay.querySelector("#cu-chapters-group").style.display =
      e.target.value === "superAdmin" ? "none" : "block";
  });

  overlay.querySelector("#toggle-pw").addEventListener("click", () => {
    const pw = overlay.querySelector("#cu-password");
    const btn = overlay.querySelector("#toggle-pw");
    pw.type = pw.type === "password" ? "text" : "password";
    btn.textContent = pw.type === "password" ? "SHOW" : "HIDE";
  });

  overlay.querySelector("#close-cu").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#cu-cancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#cu-save").addEventListener("click", async () => {
    const name = overlay.querySelector("#cu-name").value.trim();
    const email = overlay.querySelector("#cu-email").value.trim();
    const password = overlay.querySelector("#cu-password").value;
    const role = overlay.querySelector("#cu-role").value;
    const chapterIds = [...overlay.querySelectorAll(".cu-chapter-check:checked")].map(c => c.value);
    const errEl = overlay.querySelector("#cu-err");

    errEl.classList.add("hidden");
    if (!name) return showErr(errEl, "Name is required.");
    if (!email || !email.includes("@")) return showErr(errEl, "Valid email is required.");
    if (!password || password.length < 6) return showErr(errEl, "Password must be at least 6 characters.");

    const saveBtn = overlay.querySelector("#cu-save");
    overlay.querySelector("#cu-save-label").textContent = "Creating...";
    overlay.querySelector("#cu-spinner").classList.remove("hidden");
    saveBtn.disabled = true;

    try {
      // Secondary instance — Super Admin stays logged in
      const secondaryAuth = getSecondaryAuth();
      const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await updateProfile(newUser, { displayName: name });

      // Firestore profile
      await createUserProfile(newUser.uid, {
        name, email, role,
        chapterIds: role === "superAdmin" ? [] : chapterIds,
      });

      // Sign out from secondary app
      await secondaryAuth.signOut();

      showToast("User created successfully!", "success");
      overlay.remove();
      users = await getUsers();
      renderUsers(container);
    } catch (err) {
      let msg = err.message || "Failed to create user.";
      if (err.code === "auth/email-already-in-use") msg = "This email is already registered.";
      if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      if (err.code === "auth/weak-password") msg = "Password is too weak (min 6 chars).";
      showErr(errEl, msg);
      saveBtn.disabled = false;
      overlay.querySelector("#cu-save-label").textContent = "Create User";
      overlay.querySelector("#cu-spinner").classList.add("hidden");
    }
  });
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
      <div class="form-row">
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
      </div>
      <div class="form-group" id="eu-chapters-group" ${user.role === "superAdmin" ? "style='display:none;'" : ""}>
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
  overlay.querySelector("#eu-role").addEventListener("change", e => {
    overlay.querySelector("#eu-chapters-group").style.display =
      e.target.value === "superAdmin" ? "none" : "block";
  });
  overlay.querySelector("#close-eu").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#eu-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#eu-save").addEventListener("click", async () => {
    const errEl = overlay.querySelector("#eu-err");
    try {
      await updateUserProfile(user.id, {
        name: overlay.querySelector("#eu-name").value.trim(),
        role: overlay.querySelector("#eu-role").value,
        chapterIds: overlay.querySelector("#eu-role").value === "superAdmin"
          ? [] : [...overlay.querySelectorAll(".eu-chapter-check:checked")].map(c => c.value),
      });
      showToast(t("success"), "success");
      overlay.remove();
      users = await getUsers();
      renderUsers(container);
    } catch (err) { showErr(errEl, err.message); }
  });
}

function showDeleteConfirm(uid, name, container) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title" style="color:var(--danger);">Delete User</h2>
        <button class="modal-close" id="close-del">✕</button>
      </div>
      <p style="color:var(--text-secondary);margin-bottom:8px;">Are you sure you want to delete <strong>${name}</strong>?</p>
      <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:20px;">This removes them from the app. Their Firebase Auth login must be removed from Firebase Console if needed.</p>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="del-cancel">${t("cancel")}</button>
        <button class="btn btn-danger" id="del-confirm">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#close-del").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#del-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#del-confirm").addEventListener("click", async () => {
    try {
      await deleteDoc(doc(db, "users", uid));
      showToast("User removed.", "success");
      overlay.remove();
      users = await getUsers();
      renderUsers(container);
    } catch (err) { showToast("Error: " + err.message, "error"); }
  });
}

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}
