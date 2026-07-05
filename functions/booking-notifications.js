/* ============================================================
   BOOKING NOTIFICATIONS — reusable email senders
   Wraps notification-service.js + email-templates.js so callers
   (index.js, notifications.js, driver/admin flows) don't need to
   know template keys or field-shaping details.
   Every function here NEVER throws — always resolves — so it can
   safely be called from inside verifyRazorpayPayment() without
   risking the payment response.
   ============================================================ */
const { sendCustomerEmail } = require("./notification-service");

async function sendBookingConfirmationEmail({ bookingRef, customerName, customerEmail, pickup, drop, date, total, paymentStatus }) {
  if (!customerEmail) {
    console.log(`ℹ️ Skipping booking confirmation email for ${bookingRef} — no email on file`);
    return { success: false, error: "NO_EMAIL" };
  }
  try {
    const result = await sendCustomerEmail("booking_confirmed", customerEmail, {
      bookingRef, customerName, pickup, drop, date, total, paymentStatus
    });
    console.log(`📧 Booking confirmation email → ${customerEmail}: ${result.success ? "SENT" : "FAILED (" + result.error + ")"}`);
    return result;
  } catch (e) {
    console.error("sendBookingConfirmationEmail unexpected error:", e.message);
    return { success: false, error: e.message };
  }
}

async function sendDriverAssignedEmail({ bookingRef, customerName, customerEmail, driverName, driverPhone, pickup, drop, date }) {
  if (!customerEmail) {
    console.log(`ℹ️ Skipping driver-assigned email for ${bookingRef} — no email on file`);
    return { success: false, error: "NO_EMAIL" };
  }
  try {
    const result = await sendCustomerEmail("driver_assigned", customerEmail, {
      bookingRef, customerName, driverName, driverPhone, pickup, drop, date
    });
    console.log(`📧 Driver assigned email → ${customerEmail}: ${result.success ? "SENT" : "FAILED (" + result.error + ")"}`);
    return result;
  } catch (e) {
    console.error("sendDriverAssignedEmail unexpected error:", e.message);
    return { success: false, error: e.message };
  }
}

async function sendMoveReminderEmail({ bookingRef, customerName, customerEmail, pickup, drop, date, timeSlot }) {
  if (!customerEmail) {
    console.log(`ℹ️ Skipping move reminder email for ${bookingRef} — no email on file`);
    return { success: false, error: "NO_EMAIL" };
  }
  try {
    const result = await sendCustomerEmail("booking_reminder", customerEmail, {
      bookingRef, customerName, pickup, drop, date, timeSlot
    });
    console.log(`📧 Move reminder email → ${customerEmail}: ${result.success ? "SENT" : "FAILED (" + result.error + ")"}`);
    return result;
  } catch (e) {
    console.error("sendMoveReminderEmail unexpected error:", e.message);
    return { success: false, error: e.message };
  }
}

async function sendBookingCompletedEmail({ bookingRef, customerName, customerEmail, pickup, drop, date, total }) {
  if (!customerEmail) {
    console.log(`ℹ️ Skipping booking completed email for ${bookingRef} — no email on file`);
    return { success: false, error: "NO_EMAIL" };
  }
  try {
    const result = await sendCustomerEmail("booking_completed", customerEmail, {
      bookingRef, customerName, pickup, drop, date, total
    });
    console.log(`📧 Booking completed email → ${customerEmail}: ${result.success ? "SENT" : "FAILED (" + result.error + ")"}`);
    return result;
  } catch (e) {
    console.error("sendBookingCompletedEmail unexpected error:", e.message);
    return { success: false, error: e.message };
  }
}

async function sendReviewRequestEmail({ bookingRef, customerName, customerEmail, pickup, drop, date }) {
  if (!customerEmail) {
    console.log(`ℹ️ Skipping review request email for ${bookingRef} — no email on file`);
    return { success: false, error: "NO_EMAIL" };
  }
  try {
    const result = await sendCustomerEmail("feedback_request", customerEmail, {
      bookingRef, customerName, pickup, drop, date
    });
    console.log(`📧 Review request email → ${customerEmail}: ${result.success ? "SENT" : "FAILED (" + result.error + ")"}`);
    return result;
  } catch (e) {
    console.error("sendReviewRequestEmail unexpected error:", e.message);
    return { success: false, error: e.message };
  }
}

module.exports = {
  sendBookingConfirmationEmail,
  sendDriverAssignedEmail,
  sendMoveReminderEmail,
  sendBookingCompletedEmail,
  sendReviewRequestEmail
};