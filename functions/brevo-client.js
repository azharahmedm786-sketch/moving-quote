/* ============================================================
   BREVO EMAIL CLIENT
   Reusable helper for sending transactional emails via Brevo API.
   API key read from Firebase environment config — never hardcoded.

   Set the key with:
   firebase functions:config:set brevo.apikey="YOUR_BREVO_API_KEY" brevo.senderemail="no-reply@packzenblr.in" brevo.sendername="PackZen Packers & Movers"
   ============================================================ */
const functions = require("firebase-functions");
const https = require("https");

function getBrevoConfig() {
  const cfg = functions.config().brevo || {};
  return {
    apiKey: cfg.apikey || null,
    senderEmail: cfg.senderemail || "no-reply@packzenblr.in",
    senderName: cfg.sendername || "PackZen Packers & Movers"
  };
}

/**
 * Sends a transactional email via Brevo's REST API (v3/smtp/email).
 * Returns a Promise resolving to { success, response, error }.
 * Never throws — always resolves so callers can log the outcome.
 */
function sendBrevoEmail({ toEmail, toName, subject, htmlContent }) {
  return new Promise((resolve) => {
    const { apiKey, senderEmail, senderName } = getBrevoConfig();

    if (!apiKey) {
      resolve({ success: false, response: null, error: "BREVO_API_KEY_NOT_CONFIGURED" });
      return;
    }
    if (!toEmail) {
      resolve({ success: false, response: null, error: "MISSING_RECIPIENT_EMAIL" });
      return;
    }

    const payload = JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: toName || toEmail }],
      subject: subject,
      htmlContent: htmlContent
    });

    const options = {
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, response: parsed, error: null });
          } else {
            resolve({ success: false, response: parsed, error: parsed.message || ("HTTP " + res.statusCode) });
          }
        } catch (e) {
          resolve({ success: false, response: body.slice(0, 500), error: "Invalid JSON response: " + e.message });
        }
      });
    });

    req.on("error", (err) => {
      resolve({ success: false, response: null, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = { sendBrevoEmail, getBrevoConfig };
