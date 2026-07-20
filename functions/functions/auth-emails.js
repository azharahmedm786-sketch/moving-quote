const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const { defineSecret, defineString } = require("firebase-functions/params");
const { sendBrevoEmail, BREVO_SECRETS } = require("./brevo-client");
const { logNotification } = require("./notification-service");

const ACTION_URL       = defineString("PACKZEN_ACTION_URL", { default: "https://packzenblr.in/" });
const PACKZEN_LOGO_URL = defineString("PACKZEN_LOGO_URL", { default: "https://packzenblr.in/assets/logo/packzen-logo.png" });

const REQUEST_TIMEOUT_MS = 10000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const crypto = require("crypto");
const OTP_EXPIRY_MS = 10 * 60 * 1000;

/* ── EMAIL TEMPLATE (green branding, mobile responsive) ── */
function buildEmailHtml({ preheader, heading, bodyLines, ctaLabel, ctaUrl }) {
  const year = new Date().getFullYear();
  const paragraphs = bodyLines
    .map(p => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5a6a8a">${p}</p>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${heading}</title>
<style>@media only screen and (max-width:600px){.pz-container{width:100% !important}.pz-padding{padding:24px !important}}</style>
</head>
<body style="margin:0;padding:0;background:#f4f7ff;font-family:'Manrope',Arial,sans-serif">
  <span style="display:none;font-size:1px;color:#f4f7ff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader || ""}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ff;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" class="pz-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,60,180,.08)">
        <tr><td style="background:#00c96e;padding:28px 32px;text-align:center">
          <img src="${PACKZEN_LOGO_URL.value()}" alt="PackZen" width="40" height="40" style="display:block;margin:0 auto 8px;border-radius:8px">
          <span style="font-family:Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">PackZen</span>
        </td></tr>
        <tr><td class="pz-padding" style="padding:36px 40px">
          <h1 style="margin:0 0 18px;font-size:21px;font-weight:800;color:#1a2744;font-family:Arial,sans-serif">${heading}</h1>
          ${paragraphs}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
            <tr><td style="border-radius:30px;background:#00c96e">
              <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:30px;font-family:Arial,sans-serif">${ctaLabel}</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:12.5px;line-height:1.6;color:#8a9bbf">If the button above doesn't work, copy and paste this link into your browser:<br>
            <a href="${ctaUrl}" style="color:#00c96e;word-break:break-all">${ctaUrl}</a></p>
        </td></tr>
        <tr><td style="padding:24px 40px;background:#f4f7ff;border-top:1px solid #dde4f5;text-align:center">
          <p style="margin:0 0 6px;font-size:12.5px;color:#5a6a8a">Need help? Contact us at <a href="mailto:support@packzenblr.in" style="color:#00c96e;text-decoration:none">support@packzenblr.in</a></p>
          <p style="margin:0 0 6px;font-size:12.5px;color:#5a6a8a">📞 +91 99450 95453 &nbsp;·&nbsp; Bangalore, Karnataka</p>
          <p style="margin:12px 0 0;font-size:11.5px;color:#8a9bbf">© ${year} PackZen Packers &amp; Movers. All Rights Reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function stripHtml(str) { return String(str).replace(/<[^>]*>/g, ""); }

function buildEmailText({ heading, bodyLines, ctaLabel, ctaUrl }) {
  const year = new Date().getFullYear();
  return [
    heading, "",
    bodyLines.map(stripHtml).join("\n\n"), "",
    `${ctaLabel} ${ctaUrl}`, "",
    "---",
    "Need help? Contact us at support@packzenblr.in",
    "PackZen Packers & Movers — Bangalore, Karnataka",
    `© ${year} PackZen Packers & Movers. All Rights Reserved.`
  ].join("\n");
}

/* ── RATE LIMITING — Firestore-backed, per email + type ── */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;

async function enforceRateLimit(type, email) {
  const db  = admin.firestore();
  const key = `${type}_${email.toLowerCase()}`;
  const ref = db.collection("authEmailRateLimits").doc(key);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    let windowStart = data?.windowStart || 0;
    let count = data?.count || 0;

    if (now - windowStart > RATE_LIMIT_WINDOW_MS) { windowStart = now; count = 0; }

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterMin = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - windowStart)) / 60000);
      throw new functions.https.HttpsError("resource-exhausted", `Too many requests. Please try again in ${retryAfterMin} minute(s).`);
    }
    tx.set(ref, { windowStart, count: count + 1, updatedAt: now }, { merge: true });
  });
}

/* ── SEND + LOG (reuses notification-service.js's logNotification) ── */
async function sendAuthEmail(type, toEmail, toName, subject, emailContent) {
  const result = await sendBrevoEmail({
    toEmail, toName, subject,
    htmlContent: buildEmailHtml(emailContent),
    textContent: buildEmailText(emailContent)
  });
  await logNotification({
    bookingRef: null,
    channel: `auth_${type}`,
    recipient: toEmail,
    status: result.success ? "sent" : "failed",
    provider: "brevo",
    response: result.response,
    error: result.error
  });
  if (!result.success) {
    if (result.retryable) throw new functions.https.HttpsError("unavailable", "Email service temporarily unavailable. Please try again.");
    throw new functions.https.HttpsError("internal", result.error || "Failed to send email.");
  }
  return result;
}
/* ── PHASE 0 — SIGNUP OTP (verify email BEFORE account exists) ── */
exports.sendSignupOtpBrevo = functions
  .runWith({ secrets: BREVO_SECRETS })
  .region("asia-south1")
  .https.onCall(async (data, context) => {
    const email = (data?.email || "").trim().toLowerCase();
    const name = (data?.name || "").trim();
    if (!EMAIL_REGEX.test(email)) throw new functions.https.HttpsError("invalid-argument", "A valid email is required.");

    // Reject if an account already exists for this email
    try {
      await admin.auth().getUserByEmail(email);
      throw new functions.https.HttpsError("already-exists", "auth/email-already-in-use");
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
    }

    await enforceRateLimit("signup_otp", email);

    const otp = String(crypto.randomInt(100000, 999999));
    await admin.firestore().collection("signupOtps").doc(email).set({
      otp, expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0, createdAt: Date.now()
    });

    await sendAuthEmail("signup_otp", email, name, "Your PackZen verification code", {
      preheader: `Your PackZen verification code is ${otp}.`,
      heading: `Verify your email, ${name || "there"}`,
      bodyLines: [
        `Your verification code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong>`,
        "Enter this code to finish creating your PackZen account. This code expires in 10 minutes."
      ],
      ctaLabel: "Go to PackZen →", ctaUrl: ACTION_URL.value()
    });
    return { success: true };
  });

exports.verifySignupOtpBrevo = functions
  .region("asia-south1")
  .https.onCall(async (data, context) => {
    const email = (data?.email || "").trim().toLowerCase();
    const otp = (data?.otp || "").trim();
    if (!EMAIL_REGEX.test(email)) throw new functions.https.HttpsError("invalid-argument", "A valid email is required.");
    if (!otp) throw new functions.https.HttpsError("invalid-argument", "OTP is required.");

    const ref = admin.firestore().collection("signupOtps").doc(email);
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "No OTP request found. Please request a new code.");

    const record = snap.data();
    if (Date.now() > record.expiresAt) { await ref.delete(); throw new functions.https.HttpsError("deadline-exceeded", "OTP expired. Please request a new code."); }
    if (record.attempts >= 5) { await ref.delete(); throw new functions.https.HttpsError("resource-exhausted", "Too many incorrect attempts. Please request a new code."); }
    if (record.otp !== otp) { await ref.update({ attempts: (record.attempts || 0) + 1 }); throw new functions.https.HttpsError("invalid-argument", "Incorrect code. Please try again."); }

    await ref.delete();
    return { success: true };
  });
/* ── PHASE 1 — EMAIL VERIFICATION ── */
exports.sendVerificationEmailBrevo = functions
  .runWith({ secrets: BREVO_SECRETS })
  .region("asia-south1")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Must be logged in to request verification email.");
    const userRecord = await admin.auth().getUser(context.auth.uid);
    if (!userRecord.email) throw new functions.https.HttpsError("failed-precondition", "Account has no email address.");
    if (userRecord.emailVerified) return { success: true, alreadyVerified: true };

    await enforceRateLimit("email_verification", userRecord.email);

    const link = await admin.auth().generateEmailVerificationLink(userRecord.email, { url: ACTION_URL.value(), handleCodeInApp: false });

    await sendAuthEmail("email_verification", userRecord.email, userRecord.displayName, "Verify your PackZen account", {
      preheader: "Confirm your email to finish setting up your PackZen account.",
      heading: `Verify your email, ${userRecord.displayName || "there"}`,
      bodyLines: [
        "Thanks for signing up with PackZen. Please confirm your email address to finish setting up your account and start booking moves.",
        "This link will expire shortly for your security."
      ],
      ctaLabel: "Verify Email →", ctaUrl: link
    });
    return { success: true };
  });

/* ── PHASE 2 — PASSWORD RESET ── */
async function signupUser() {
  if (!checkRateLimit("signup_otp", 3, 300000)) { showError("signupError", "⚠️ Too many OTP requests. Please try again later."); return; }
  const firstName = document.getElementById("signupFirstName").value.trim();
  const lastName = document.getElementById("signupLastName").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const referral = document.getElementById("signupReferral")?.value.trim().toUpperCase() || "";

  if (!firstName) return showError("signupError", "⚠️ Please enter your first name.");
  if (!lastName) return showError("signupError", "⚠️ Please enter your last name.");
  if (!/^\d{10}$/.test(phone)) return showError("signupError", "⚠️ Please enter a valid 10-digit mobile number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("signupError", "⚠️ Please enter a valid email address.");
  if (password.length < 6) return showError("signupError", "⚠️ Password must be at least 6 characters.");

  const fullName = firstName + " " + lastName;
  const btn = document.getElementById("btnSignup");
  if (btn) { btn.disabled = true; btn.textContent = "Sending code..."; }
  showError("signupError", "⏳ Sending verification code...", "info");

  waitForFirebase(async () => {
    const { functions } = window._firebase;
    try {
      await functions.httpsCallable("sendSignupOtpBrevo")({ email, name: fullName });
      pendingSignupData = { firstName, lastName, fullName, phone, email, password, referral };
      closeAuthModal();
      openSignupOtpModal(email);
    } catch (err) {
      console.error("Signup OTP error:", err);
      if (err.code === "functions/already-exists") showError("signupError", "⚠️ This email is already registered. Please login.");
      else showError("signupError", "⚠️ " + (err.message || "Something went wrong. Please try again."));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Create Account →"; }
    }
  });
}

function openSignupOtpModal(email) {
  const modal = document.getElementById("signupOtpModal");
  if (!modal) { showToast("⚠️ OTP screen not found."); return; }
  document.getElementById("signupOtpEmailDisplay").textContent = email;
  document.getElementById("signupOtpInput").value = "";
  document.getElementById("signupOtpError").textContent = "";
  modal.style.display = "flex";
}

function closeSignupOtpModal() { document.getElementById("signupOtpModal").style.display = "none"; }

async function verifySignupOtp() {
  if (!pendingSignupData) { showToast("⚠️ Signup session expired. Please start again."); closeSignupOtpModal(); return; }
  const otp = document.getElementById("signupOtpInput").value.trim();
  if (!otp || otp.length !== 6) { showError("signupOtpError", "⚠️ Enter the 6-digit code."); return; }

  const btn = document.getElementById("btnVerifySignupOtp");
  if (btn) { btn.disabled = true; btn.textContent = "Verifying..."; }

  waitForFirebase(async () => {
    const { auth, db, functions } = window._firebase;
    const { firstName, lastName, fullName, phone, email, password, referral } = pendingSignupData;
    try {
      await functions.httpsCallable("verifySignupOtpBrevo")({ email, otp });

      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const newUser = cred.user;
      await newUser.updateProfile({ displayName: fullName });

      const refCode = newUser.uid.slice(0, 8).toUpperCase();
      await db.collection("users").doc(newUser.uid).set({
        firstName, lastName, name: fullName, email, phone: "+91" + phone,
        role: "customer", phoneVerified: false, emailVerified: true,
        prefEmail: true, prefSMS: true,
        referralCode: refCode, referralCount: 0, referralCredits: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (referral) await processReferral(referral, newUser.uid);

      pendingSignupData = null;
      closeSignupOtpModal();
      showToast(`👋 Welcome to PackZen, ${firstName}!`);
    } catch (err) {
      console.error("OTP verify / account creation error:", err);
      if (err.code === "auth/email-already-in-use") showError("signupOtpError", "⚠️ This email is already registered. Please login.");
      else if (err.code === "functions/not-found") showError("signupOtpError", "⚠️ No code found. Please request a new one.");
      else if (err.code === "functions/deadline-exceeded") showError("signupOtpError", "⚠️ Code expired. Please request a new one.");
      else if (err.code === "functions/resource-exhausted") showError("signupOtpError", "⚠️ Too many attempts. Please request a new code.");
      else if (err.code === "functions/invalid-argument") showError("signupOtpError", "⚠️ Incorrect code. Please try again.");
      else showError("signupOtpError", getAuthErrorMessage(err.code));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Verify & Create Account"; }
    }
  });
}

async function resendSignupOtp() {
  if (!pendingSignupData) return;
  const { email, fullName } = pendingSignupData;
  waitForFirebase(async () => {
    try {
      await window._firebase.functions.httpsCallable("sendSignupOtpBrevo")({ email, name: fullName });
      showToast("📧 New code sent!");
    } catch (err) { showError("signupOtpError", "⚠️ " + (err.message || "Failed to resend code.")); }
  });
}
/* ── PHASE 3 — EMAIL CHANGE ── */
exports.sendEmailChangeLinkBrevo = functions
  .runWith({ secrets: BREVO_SECRETS })
  .region("asia-south1")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    const newEmail = (data?.newEmail || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(newEmail)) throw new functions.https.HttpsError("invalid-argument", "A valid new email is required.");

    const userRecord = await admin.auth().getUser(context.auth.uid);
    if (!userRecord.email) throw new functions.https.HttpsError("failed-precondition", "Account has no current email.");

    try {
      const existing = await admin.auth().getUserByEmail(newEmail);
      if (existing.uid !== context.auth.uid) throw new functions.https.HttpsError("already-exists", "This email is already in use.");
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
    }

    await enforceRateLimit("email_change", newEmail);

    const link = await admin.auth().generateVerifyAndChangeEmailLink(userRecord.email, newEmail, { url: ACTION_URL.value(), handleCodeInApp: false });

    await sendAuthEmail("email_change", newEmail, userRecord.displayName, "Confirm your new PackZen email", {
      preheader: "Confirm your new PackZen email address.",
      heading: `Confirm your new email, ${userRecord.displayName || "there"}`,
      bodyLines: [
        "Click below to confirm this address as your new PackZen account email.",
        "If you didn't request this, you can ignore this email and your account email will stay unchanged."
      ],
      ctaLabel: "Confirm New Email →", ctaUrl: link
    });
    return { success: true };
  });
