// ============================================================
// pages/register-guest.js — Public Guest Registration (No Auth)
// ============================================================

import { getChapters, getUpcomingMeetings, registerGuestPublic } from "../firebase.js";
import { t, applyTranslations } from "../i18n.js";
import { renderLangToggle, showToast } from "../app.js";

export default function renderRegister() {
  return `
    <div id="register-page">
      <div class="register-card fade-in">
        <div class="register-header">
          <div class="register-logo">PA</div>
          <div class="register-subtitle">Progress Alliance · Guest Registration</div>
          <div id="register-lang-toggle" style="margin-top:12px;display:flex;justify-content:center;"></div>
        </div>

        <div id="register-form-area">
          <!-- Step 1: Chapter + Meeting -->
          <div id="step-1">
            <div class="register-section-title">Chapter & Meeting</div>

            <div class="form-group">
              <label class="form-label">
                <span data-i18n="chapter"></span>
                <span class="required">*</span>
              </label>
              <select id="reg-chapter" class="form-control">
                <option value="" data-i18n="selectChapter"></option>
              </select>
              <div class="form-error hidden" id="err-chapter"></div>
            </div>

            <div class="form-group">
              <label class="form-label" data-i18n="expectedMeeting"></label>
              <select id="reg-meeting" class="form-control" disabled>
                <option value="">— Select chapter first —</option>
              </select>
            </div>

            <div class="register-section-title" style="margin-top:20px;">Guest Details</div>

            <div class="form-group">
              <label class="form-label">
                <span data-i18n="guestName"></span>
                <span class="required">*</span>
              </label>
              <input type="text" id="reg-guest-name" class="form-control" data-i18n="guestName" autocomplete="off">
              <div class="form-error hidden" id="err-guest-name"></div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <span data-i18n="guestPhone"></span>
                <span class="required">*</span>
              </label>
              <input type="tel" id="reg-guest-phone" class="form-control" data-i18n="guestPhone" maxlength="15" autocomplete="off">
              <div class="form-error hidden" id="err-guest-phone"></div>
            </div>

            <div class="form-group">
              <label class="form-label" data-i18n="businessName"></label>
              <input type="text" id="reg-business-name" class="form-control" data-i18n="businessName">
            </div>

            <div class="form-group">
              <label class="form-label" data-i18n="businessType"></label>
              <select id="reg-business-type" class="form-control">
                <option value="">— Select —</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" data-i18n="feePaid"></label>
              <div class="radio-group">
                <label class="radio-option" id="fee-yes-label">
                  <input type="radio" name="feePaid" value="yes" id="fee-yes">
                  <span data-i18n="feePaidYes"></span>
                </label>
                <label class="radio-option selected" id="fee-no-label">
                  <input type="radio" name="feePaid" value="no" id="fee-no" checked>
                  <span data-i18n="feePaidNo"></span>
                </label>
              </div>
            </div>

            <div class="register-section-title">Your Details (Referring Member)</div>

            <div class="form-group">
              <label class="form-label">
                <span data-i18n="referredByName"></span>
                <span class="required">*</span>
              </label>
              <input type="text" id="reg-ref-name" class="form-control" data-i18n="referredByName">
              <div class="form-error hidden" id="err-ref-name"></div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <span data-i18n="referredByPhone"></span>
                <span class="required">*</span>
              </label>
              <input type="tel" id="reg-ref-phone" class="form-control" data-i18n="referredByPhone" maxlength="15">
              <div class="form-error hidden" id="err-ref-phone"></div>
            </div>

            <button class="btn btn-primary btn-full btn-lg" id="reg-submit" style="margin-top:8px;">
              <span data-i18n="submit"></span>
            </button>
          </div>

          <!-- Success State -->
          <div id="step-success" class="hidden" style="text-align:center;padding:32px 0;">
            <div style="font-size:3.5rem;margin-bottom:16px;">🎉</div>
            <h2 style="font-family:var(--font-display);color:var(--gold);margin-bottom:8px;" data-i18n="guestRegistered"></h2>
            <p style="color:var(--text-muted);margin-bottom:24px;font-size:0.9rem;">
              The chapter admin has been notified.
            </p>
            <button class="btn btn-secondary" id="reg-another" style="margin-bottom:10px;width:100%;" data-i18n="submitAnother"></button>
            <button class="btn btn-ghost" id="reg-backhome" style="width:100%;" data-i18n="backToHome"></button>
          </div>
        </div>
      </div>
    </div>
    <div id="toast-container"></div>
  `;
}

export async function initRegisterPage() {
  applyTranslations();

  // Populate chapters
  try {
    const chapters = await getChapters();
    const chapterSel = document.getElementById("reg-chapter");
    chapters.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name}${c.city ? " — " + c.city : ""}`;
      chapterSel.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load chapters", e);
  }

  // Populate business types
  const btSel = document.getElementById("reg-business-type");
  const types = t("businessTypes");
  types.forEach((bt) => {
    const opt = document.createElement("option");
    opt.value = bt;
    opt.textContent = bt;
    btSel.appendChild(opt);
  });

  // Chapter change → load meetings
  document.getElementById("reg-chapter").addEventListener("change", async (e) => {
    const chapterId = e.target.value;
    const meetingSel = document.getElementById("reg-meeting");
    meetingSel.innerHTML = `<option value="">— ${t("loading")} —</option>`;
    meetingSel.disabled = true;

    if (!chapterId) {
      meetingSel.innerHTML = `<option value="">— Select chapter first —</option>`;
      return;
    }

    try {
      const meetings = await getUpcomingMeetings(chapterId);
      meetingSel.innerHTML = `<option value="notDecided">${t("notDecided")}</option>`;
      meetings.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.id;
        const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
        opt.textContent = `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}${m.venue ? " · " + m.venue : ""}`;
        meetingSel.appendChild(opt);
      });
      meetingSel.disabled = false;
    } catch (err) {
      meetingSel.innerHTML = `<option value="notDecided">${t("notDecided")}</option>`;
      meetingSel.disabled = false;
    }
  });

  // Fee radio toggle
  document.querySelectorAll('input[name="feePaid"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.getElementById("fee-yes-label").classList.toggle("selected", document.getElementById("fee-yes").checked);
      document.getElementById("fee-no-label").classList.toggle("selected", document.getElementById("fee-no").checked);
    });
  });

  // Submit
  document.getElementById("reg-submit").addEventListener("click", handleSubmit);

  // Post-success buttons
  document.getElementById("reg-another").addEventListener("click", () => {
    document.getElementById("step-1").classList.remove("hidden");
    document.getElementById("step-success").classList.add("hidden");
    document.getElementById("reg-guest-name").value = "";
    document.getElementById("reg-guest-phone").value = "";
    document.getElementById("reg-business-name").value = "";
    document.getElementById("reg-business-type").value = "";
    document.getElementById("reg-meeting").value = "";
  });

  document.getElementById("reg-backhome").addEventListener("click", () => {
    window.location.hash = "";
    window.location.reload();
  });
}

async function handleSubmit() {
  // Clear errors
  document.querySelectorAll(".form-error").forEach((el) => el.classList.add("hidden"));

  const chapterId = document.getElementById("reg-chapter").value;
  const guestName = document.getElementById("reg-guest-name").value.trim();
  const guestPhone = document.getElementById("reg-guest-phone").value.trim();
  const businessName = document.getElementById("reg-business-name").value.trim();
  const businessType = document.getElementById("reg-business-type").value;
  const refName = document.getElementById("reg-ref-name").value.trim();
  const refPhone = document.getElementById("reg-ref-phone").value.trim();
  const meetingId = document.getElementById("reg-meeting").value;
  const feePaid = document.getElementById("fee-yes").checked;

  let valid = true;

  if (!chapterId) {
    showError("err-chapter", t("required"));
    valid = false;
  }
  if (!guestName) {
    showError("err-guest-name", t("required"));
    valid = false;
  }
  if (!guestPhone) {
    showError("err-guest-phone", t("required"));
    valid = false;
  }
  if (!refName) {
    showError("err-ref-name", t("required"));
    valid = false;
  }
  if (!refPhone) {
    showError("err-ref-phone", t("required"));
    valid = false;
  }

  if (!valid) return;

  const btn = document.getElementById("reg-submit");
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>`;

  try {
    await registerGuestPublic({
      chapterId,
      name: guestName,
      phone: guestPhone,
      businessName,
      businessType,
      referredByName: refName,
      referredByPhone: refPhone,
      expectedMeetingId: meetingId === "notDecided" ? null : meetingId || null,
      meetingDecided: meetingId && meetingId !== "notDecided",
      feePaid,
    });

    document.getElementById("step-1").classList.add("hidden");
    document.getElementById("step-success").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    showToast(t("error") + ": " + err.message, "error");
    btn.disabled = false;
    btn.innerHTML = `<span data-i18n="submit">${t("submit")}</span>`;
  }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }
}
