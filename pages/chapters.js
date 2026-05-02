// ============================================================
// pages/chapters.js — Chapter Management (Super Admin)
// ============================================================

import { showToast } from "../app.js";
import {
  getChapters, createChapter, updateChapter, deleteChapter, getUsers
} from "../firebase.js";
import { t } from "../i18n.js";

let chapters = [];
let users = [];

export default async function initChapters(container) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;

  try {
    [chapters, users] = await Promise.all([getChapters(), getUsers()]);
    renderChapters(container);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>${err.message}</p></div>`;
  }
}

function renderChapters(container) {
  const adminUsers = users.filter(u => u.role === "chapterAdmin");

  container.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">${t("chaptersList")}</h1>
          <div class="page-subtitle">${chapters.length} chapters</div>
        </div>
        <button class="btn btn-primary" id="add-chapter-btn">+ ${t("addChapter")}</button>
      </div>

      ${chapters.length === 0 ? `
        <div class="empty-state">
          <span class="empty-state-icon">🏠</span>
          <p>${t("noChapters")}</p>
          <button class="btn btn-primary" id="empty-add-btn">+ ${t("addChapter")}</button>
        </div>
      ` : chapters.map(ch => {
        const chAdmins = adminUsers.filter(u => (u.chapterIds || []).includes(ch.id));
        return `
          <div class="card" style="margin-bottom:10px;">
            <div class="flex items-center justify-between">
              <div>
                <div style="font-family:var(--font-display);font-size:1rem;font-weight:600;">${ch.name}</div>
                <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">
                  ${ch.city || "—"}
                  ${chAdmins.length ? ` · Admins: ${chAdmins.map(u => u.name).join(", ")}` : " · No admins assigned"}
                </div>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-ghost btn-sm edit-chapter-btn" data-id="${ch.id}">
                  ${t("edit")}
                </button>
                <button class="btn btn-danger btn-sm delete-chapter-btn" data-id="${ch.id}">
                  ${t("delete")}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  container.querySelector("#add-chapter-btn")?.addEventListener("click", () => showChapterModal(null, adminUsers, container));
  container.querySelector("#empty-add-btn")?.addEventListener("click", () => showChapterModal(null, adminUsers, container));

  container.querySelectorAll(".edit-chapter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const chapter = chapters.find(c => c.id === btn.dataset.id);
      showChapterModal(chapter, adminUsers, container);
    });
  });

  container.querySelectorAll(".delete-chapter-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(t("confirmDelete"))) return;
      await deleteChapter(btn.dataset.id);
      showToast(t("success"), "success");
      chapters = await getChapters();
      renderChapters(container);
    });
  });
}

function showChapterModal(existing, adminUsers, container) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const assignedAdmins = existing
    ? adminUsers.filter(u => (u.chapterIds || []).includes(existing.id)).map(u => u.id)
    : [];

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${existing ? t("edit") : t("addChapter")}</h2>
        <button class="modal-close" id="close-ch">✕</button>
      </div>

      <div class="form-group">
        <label class="form-label">${t("chapterName")} <span class="required">*</span></label>
        <input id="ch-name" class="form-control" value="${existing?.name || ""}">
      </div>
      <div class="form-group">
        <label class="form-label">${t("chapterCity")}</label>
        <input id="ch-city" class="form-control" value="${existing?.city || ""}">
      </div>

      <div class="form-group">
        <label class="form-label">${t("chapterAdmins")}</label>
        <div style="max-height:160px;overflow-y:auto;background:var(--navy);border:1px solid var(--navy-border);border-radius:var(--radius-sm);padding:8px;">
          ${adminUsers.length === 0 ? `<p class="text-muted text-sm">No chapter admins found. Add users first.</p>` :
            adminUsers.map(u => `
              <label style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-radius:4px;" class="admin-option">
                <input type="checkbox" class="ch-admin-check" value="${u.id}" ${assignedAdmins.includes(u.id) ? "checked" : ""}>
                <span style="font-size:0.875rem;">${u.name} <span style="color:var(--text-muted);font-size:0.75rem;">${u.email}</span></span>
              </label>
            `).join("")
          }
        </div>
      </div>

      <div id="ch-err" class="form-error hidden" style="margin-bottom:8px;"></div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="ch-cancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="ch-save">${t("save")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("#close-ch").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#ch-cancel").addEventListener("click", () => overlay.remove());

  overlay.querySelector("#ch-save").addEventListener("click", async () => {
    const name = overlay.querySelector("#ch-name").value.trim();
    const errEl = overlay.querySelector("#ch-err");
    if (!name) {
      errEl.textContent = t("required");
      errEl.classList.remove("hidden");
      return;
    }

    const selectedAdminIds = [...overlay.querySelectorAll(".ch-admin-check:checked")].map(c => c.value);

    try {
      const data = {
        name,
        city: overlay.querySelector("#ch-city").value.trim(),
        adminUids: selectedAdminIds,
      };

      let chapterId;
      if (existing) {
        await updateChapter(existing.id, data);
        chapterId = existing.id;
      } else {
        const ref = await createChapter(data);
        chapterId = ref.id;
      }

      // Update each admin user's chapterIds
      const { getUsers: fetchUsers, updateUserProfile } = await import("../firebase.js");
      const allUsers = await fetchUsers();

      for (const user of allUsers.filter(u => u.role === "chapterAdmin")) {
        const currentChapters = user.chapterIds || [];
        let updatedChapters;

        if (selectedAdminIds.includes(user.id)) {
          // Add chapter to this user
          updatedChapters = currentChapters.includes(chapterId)
            ? currentChapters
            : [...currentChapters, chapterId];
        } else {
          // Remove chapter from this user if they were previously assigned
          updatedChapters = currentChapters.filter(id => id !== chapterId);
        }

        if (JSON.stringify(updatedChapters) !== JSON.stringify(currentChapters)) {
          await updateUserProfile(user.id, { chapterIds: updatedChapters });
        }
      }

      showToast(t("success"), "success");
      overlay.remove();
      [chapters, users] = await Promise.all([getChapters(), getUsers()]);
      renderChapters(container);
    } catch (err) {
      errEl.textContent = t("error") + ": " + err.message;
      errEl.classList.remove("hidden");
    }
  });
}
