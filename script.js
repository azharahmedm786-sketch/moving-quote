/* ============================================
   PackZen — script.js  (Full Feature Set — FIXED)
   ============================================ */

// ─── State ───────────────────────────────────
let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;
let lastCalculatedTotal  = 0;
let paymentReceiptId     = "";
let confirmationResult   = null;
let pendingSignupData    = null;
let currentUser          = null;
let promoDiscount        = 0;
let selectedPayment      = "at_drop";
let currentRating        = 0;
let trackingListener     = null;
let chatListener         = null;
let trackingMap          = null;
let trackingDriverMarker = null;
let currentBookingId     = null;
let uploadedPhotos       = [];
let pendingWhatsAppMsg   = null;
let pendingAdminMsg      = null;

// ─── Reset flow state ────────────────────────
let resetFlowPhone     = "";
let otpTimerInterval   = null;

/* ============================================
   OWNER NOTIFICATION
   ============================================ */
const OWNER_WHATSAPP = "919945095453";

// ================= EMAIL FUNCTION =================
function sendEmailNotification(bookingRef, name, phone, pickup, drop, date, total) {
  emailjs.send("service_surriec", "template_hffggde", {
    booking_id: bookingRef,
    name: name,
    phone: phone,
    pickup: pickup,
    drop: drop,
    date: date,
    amount: total
  })
  .then(() => { console.log("✅ Email sent"); })
  .catch((err) => { console.error("❌ Email failed:", err); });
}
// ================= SAVE BOOKING =================
async function saveBooking(data) {
  const db = window._firebase.db;

  try {
    const docRef = await db.collection("bookings").add({
      ...data,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log("✅ Booking saved:", docRef.id);
    return docRef.id;

  } catch (err) {
    console.error("❌ Error saving booking:", err);
    alert("Booking failed. Try again.");
  }
}

// ================= NOTIFY OWNER =================

function notifyOwner(bookingRef, name, phone, pickup, drop, date, total, payType, source) {
  sendEmailNotification(bookingRef, name, phone, pickup, drop, date, total);
  const emoji  = source === "online" ? "💳" : source === "whatsapp" ? "📲" : "📋";
  const payLbl = source === "online" ? "Paid Online ✅" : source === "whatsapp" ? "WhatsApp booking" : "Pay on delivery";
  const msg =
    `${emoji} *New Booking Alert — PackZen* 🚚\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 *ID:* ${bookingRef}\n👤 *Customer:* ${name}\n📞 *Phone:* +91 ${phone}\n` +
    `📍 *Pickup:* ${pickup}\n🏁 *Drop:* ${drop}\n📅 *Date:* ${date || "To be confirmed"}\n` +
    `💰 *Amount:* ₹${Number(total).toLocaleString("en-IN")}\n💳 *Payment:* ${payLbl}\n` +
    `━━━━━━━━━━━━━━━━━━━━\nReply CONFIRM or call customer now.`;
  setTimeout(() => {
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }, 1500);
}

const RAZORPAY_KEY = (window.ENV && window.ENV.RAZORPAY_KEY) || "";

/* ============================================
   UTILITY
   ============================================ */
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/* ============================================
   BOTTOM SHEET SYSTEM
   ============================================ */
let _activeBs = null;

function openBottomSheet(id) {
  closeAllBottomSheets();
  const sheet   = document.getElementById(id);
  const overlay = document.getElementById("bsOverlay");
  if (!sheet || !overlay) return;
  if (id === "bsDate")  buildBsDateStrip();
  if (id === "bsHouse") buildBsHouseOptions();
  overlay.classList.add("open");
  sheet.classList.add("open");
  _activeBs = id;
  document.body.style.overflow = "hidden";
}

function closeAllBottomSheets() {
  document.querySelectorAll(".bottom-sheet.open").forEach(s => s.classList.remove("open"));
  const overlay = document.getElementById("bsOverlay");
  if (overlay) overlay.classList.remove("open");
  _activeBs = null;
  document.body.style.overflow = "";
}

function buildBsDateStrip() {
  const strip = document.getElementById("bsDateStrip");
  if (!strip) return;
  strip.innerHTML = "";
  const today  = new Date(); today.setHours(0,0,0,0);
  const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const selected = document.getElementById("shiftDate")?.value;
  const di = document.getElementById("bsDateInput");
  if (di) di.min = today.toISOString().split("T")[0];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds   = d.toISOString().split("T")[0];
    const card = document.createElement("div");
    card.className = "bs-date-card" + (i === 0 ? " today-card" : "") + (ds === selected ? " selected" : "");
    card.dataset.date = ds;
    card.innerHTML = `
      <div class="bs-dc-day">${DAYS[d.getDay()]}</div>
      <div class="bs-dc-num">${d.getDate()}</div>
      <div class="bs-dc-month">${MONTHS[d.getMonth()]}</div>
      ${i === 0 ? '<div class="bs-dc-tag">Today</div>' : i === 1 ? '<div class="bs-dc-tag">Tomorrow</div>' : ''}`;
    card.addEventListener("click", () => {
      strip.querySelectorAll(".bs-date-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      applyDate(ds, d);
    });
    strip.appendChild(card);
  }
}

function onBsDatePicked(val) {
  if (!val) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(val + "T00:00:00");
  if (d < today) { showToast("⚠️ Please select today or a future date."); return; }
  document.querySelectorAll(".bs-date-card").forEach(c => c.classList.remove("selected"));
  applyDate(val, d);
}

function applyDate(ds, d) {
  const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  document.getElementById("shiftDate").value = ds;
  const trigger = document.getElementById("dateTrigger");
  const text    = document.getElementById("dateTriggerText");
  if (trigger) trigger.classList.add("filled");
  if (text)    text.textContent = DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  closeAllBottomSheets();
  calculateQuote(true);
}

function pickTimeSlot(value, label) {
  document.getElementById("shiftTime").value = value;
  document.getElementById("shiftTimeLabel").value = label;
  document.querySelectorAll("#bsTime .bs-option").forEach(b => b.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
  const trigger = document.getElementById("timeTrigger");
  const text    = document.getElementById("timeTriggerText");
  if (trigger) trigger.classList.add("filled");
  if (text)    text.textContent = label;
  setTimeout(closeAllBottomSheets, 250);
}

function buildBsHouseOptions() {
  const body = document.getElementById("bsHouseBody");
  if (!body) return;
  const config = window.MOVE_TYPE_CONFIG?.[selectedMoveType || "home"] || window.MOVE_TYPE_CONFIG?.home;
  if (!config) return;
  const title = document.querySelector("#bsHouse .bs-title");
  if (title) title.textContent = "🏠 " + config.sizeLabel;
  const selected = document.getElementById("house")?.value;
  body.innerHTML = '<div class="bs-house-grid">' +
    config.sizes.map(s => `
      <div class="bs-house-card ${s.value === selected ? "selected" : ""}"
           onclick="pickHouseType('${s.value}','${s.icon} ${s.label}','${s.label}')">
        <div class="bs-house-icon">${s.icon}</div>
        <div class="bs-house-label">${s.label}</div>
        <div class="bs-house-sub">${s.sub || ""}</div>
      </div>`).join("") + "</div>";
}

function pickHouseType(value, label, shortLabel) {
  const sel = document.getElementById("house");
  if (sel) sel.value = value;
  document.querySelectorAll(".bs-house-card").forEach(c => c.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
  const trigger = document.getElementById("houseTrigger");
  const text    = document.getElementById("houseTriggerText");
  if (trigger) trigger.classList.add("filled");
  if (text) text.textContent = label;
  setTimeout(() => { closeAllBottomSheets(); calculateQuote(true); }, 250);
}

function pickVehicle(value, label, sub, price) {
  const sel = document.getElementById("vehicle");
  if (sel) sel.value = value;
  document.querySelectorAll(".bs-vehicle-opt").forEach(b => b.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
  const trigger = document.getElementById("vehicleTrigger");
  const text    = document.getElementById("vehicleTriggerText");
  if (trigger) trigger.classList.add("filled");
  if (text) text.textContent = label + "  ·  " + price;
  setTimeout(() => { closeAllBottomSheets(); calculateQuote(true); }, 250);
}

function pickFloor(type, value, label, price) {
  const sel = document.getElementById(type === "pickup" ? "pickupFloor" : "dropFloor");
  if (sel) sel.value = value;
  const sheetId   = type === "pickup" ? "bsPickupFloor" : "bsDropFloor";
  const triggerId = type === "pickup" ? "pickupFloorTrigger" : "dropFloorTrigger";
  const textId    = type === "pickup" ? "pickupFloorText" : "dropFloorText";
  document.querySelectorAll("#" + sheetId + " .bs-option").forEach(b => b.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
  const trigger = document.getElementById(triggerId);
  const text    = document.getElementById(textId);
  if (trigger) trigger.classList.add("filled");
  if (text) text.textContent = label + "  " + price;
  setTimeout(() => { closeAllBottomSheets(); calculateQuote(true); }, 250);
}

(function () {
  let startY = 0;
  document.addEventListener("touchstart", e => {
    if (e.target.closest(".bottom-sheet")) startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!_activeBs) return;
    if (e.changedTouches[0].clientY - startY > 80) closeAllBottomSheets();
  }, { passive: true });
})();

/* ============================================
   DATE PICKER
   ============================================ */
function buildDateStrip() {
  const strip = document.getElementById("dateStrip");
  if (!strip) return;
  strip.innerHTML = "";
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  for (let i = 0; i < 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const card = document.createElement("div");
    card.className = "date-card" + (i === 0 ? " today-card" : "");
    card.dataset.date = d.toISOString().split("T")[0];
    card.innerHTML = `
      <div class="dc-day">${days[d.getDay()]}</div>
      <div class="dc-num">${d.getDate()}</div>
      <div class="dc-month">${months[d.getMonth()]}</div>
      ${i === 0 ? '<div class="dc-tag">Today</div>' : i === 1 ? '<div class="dc-tag">Tomorrow</div>' : ""}`;
    card.addEventListener("click", () => selectDateCard(card, d));
    strip.appendChild(card);
  }
}

function selectDateCard(card, dateObj) {
  document.querySelectorAll(".date-card").forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");
  const shiftDate = document.getElementById("shiftDate");
  if (shiftDate) shiftDate.value = dateObj.toISOString().split("T")[0];
  const label  = document.getElementById("dateSelectedLabel");
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (label) {
    label.textContent = `✅ ${days[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
    label.className = "date-selected-label has-date";
  }
  calculateQuote(true);
}

function openCustomDate() {
  const input = document.getElementById("shiftDate");
  if (!input) return;
  input.min = new Date().toISOString().split("T")[0];
  input.style.cssText = "position:fixed;opacity:0;top:50%;left:50%;width:1px;height:1px;";
  input.click();
  setTimeout(() => { input.style.cssText = "position:absolute;width:0;height:0;"; }, 500);
}

function onCustomDatePicked(val) {
  if (!val) return;
  const d     = new Date(val + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  if (d < today) { showToast("⚠️ Please select today or a future date."); return; }
  document.querySelectorAll(".date-card").forEach(c => c.classList.remove("selected"));
  const match = document.querySelector(`.date-card[data-date="${val}"]`);
  if (match) match.classList.add("selected");
  const label  = document.getElementById("dateSelectedLabel");
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (label) {
    label.textContent = `✅ ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    label.className = "date-selected-label has-date";
  }
  calculateQuote(true);
}

function selectTimeSlot(btn, value, label, range) {
  document.querySelectorAll(".time-slot-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  const timeInput  = document.getElementById("shiftTime");
  const labelInput = document.getElementById("shiftTimeLabel");
  if (timeInput)  timeInput.value  = value;
  if (labelInput) labelInput.value = range;
}

/* ============================================
   PAGE LOAD
   ============================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("packzen-theme") === "dark") {
    document.body.classList.add("dark-mode");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = "☀️";
  }

  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!["INPUT","TEXTAREA","SELECT"].includes(el.tagName)) return;
    if (window.innerWidth > 768) return;
    setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 320);
  });

  const makeVisible = () => document.querySelectorAll(".reveal, .reveal-stagger").forEach(el => el.classList.add("visible"));
  makeVisible(); setTimeout(makeVisible, 100); setTimeout(makeVisible, 500);

  const STAT_VALUES = [100, 2026, 100, 0];
  document.querySelectorAll(".stat-number").forEach((el, i) => {
    if (STAT_VALUES[i] !== undefined) {
      el.setAttribute("data-target", STAT_VALUES[i]);
      el.removeAttribute("data-animated");
      el.textContent = STAT_VALUES[i].toLocaleString("en-IN");
    }
  });

  function animateCounter(el) {
    if (el.dataset.animated) return;
    el.dataset.animated = "1";
    const target = parseInt(el.getAttribute("data-target"), 10);
    if (isNaN(target)) return;
    const dur = 2000, start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target).toLocaleString("en-IN");
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString("en-IN");
    }
    requestAnimationFrame(tick);
  }

  const statsObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.querySelectorAll(".stat-number").forEach(animateCounter);
        statsObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  const strip = document.getElementById("statsStrip");
  if (strip) {
    statsObs.observe(strip);
    setTimeout(() => {
      if (strip.getBoundingClientRect().top < window.innerHeight) {
        strip.querySelectorAll(".stat-number").forEach(animateCounter);
        statsObs.unobserve(strip);
      }
    }, 500);
  }

  document.querySelectorAll("button, .btn-primary, .btn-ghost").forEach(btn => {
    btn.addEventListener("click", function (e) {
      const r    = document.createElement("span"); r.classList.add("ripple");
      const rect = this.getBoundingClientRect(), size = Math.max(rect.width, rect.height);
      r.style.width  = r.style.height = size + "px";
      r.style.left   = e.clientX - rect.left - size / 2 + "px";
      r.style.top    = e.clientY - rect.top  - size / 2 + "px";
      this.appendChild(r); r.addEventListener("animationend", () => r.remove());
    });
  });

  const priceEl = document.getElementById("livePrice");
  if (priceEl) new MutationObserver(() => {
    priceEl.classList.remove("updated"); void priceEl.offsetWidth; priceEl.classList.add("updated");
  }).observe(priceEl, { childList: true });

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", function (e) {
      const t = document.querySelector(this.getAttribute("href"));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); }
    });
  });

  const navbar = document.querySelector(".navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      navbar.style.background = window.scrollY > 50 ? "rgba(5,13,26,0.97)" : "rgba(5,13,26,0.85)";
    }, { passive: true });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-user")) document.getElementById("userDropdown")?.classList.remove("open");
  });

  waitForFirebase(() => {
    const auth = window._firebase.auth;
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    auth.onAuthStateChanged(user => {
      currentUser = user;
      updateNavForUser(user);
      if (user) {
        window._firebase.db.collection("users").doc(user.uid).get().then(doc => {
          if (doc.exists) prefillBookingForm(doc.data());
        });
        checkAndShowActiveBooking(user.uid);
      } else {
        const banner = document.getElementById("trackOrderBanner");
        if (banner) banner.style.display = "none";
      }
    });
  });

  loadReviewsPublic();
  buildChecklist();
  setTimeout(() => renderSizeCards("home"), 100);
  initPaymentOptions();
  buildDateStrip();

  if (!document.getElementById("pz-fc-styles")) {
    const s = document.createElement("style");
    s.id = "pz-fc-styles";
    s.textContent = `
      .furniture-grid{display:flex;flex-direction:column;gap:8px;}
      .fc-category{border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;}
      .fc-category-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,255,255,0.04);cursor:pointer;transition:background .2s;user-select:none;}
      .fc-category-header:hover{background:rgba(255,255,255,0.08);}
      .fc-cat-icon{font-size:1.1rem;}
      .fc-cat-label{flex:1;font-weight:600;font-size:.9rem;color:var(--text,#fff);}
      .fc-cat-arrow{font-size:.8rem;color:var(--text-muted,#aaa);transition:transform .2s;}
      .fc-category-items{display:none;flex-wrap:wrap;gap:8px;padding:12px;background:rgba(255,255,255,0.02);}
      .furniture-card{display:flex;flex-direction:column;align-items:center;width:80px;cursor:pointer;position:relative;}
      .furniture-card input[type=checkbox]{position:absolute;opacity:0;width:0;height:0;}
      .fc-body{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:10px;width:100%;text-align:center;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);transition:all .2s;position:relative;}
      .furniture-card input:checked~.fc-body{border-color:#3b82f6;background:rgba(59,130,246,0.15);}
      .fc-check{position:absolute;top:4px;right:4px;width:16px;height:16px;background:#3b82f6;border-radius:50%;font-size:9px;color:#fff;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(0);transition:all .15s;}
      .furniture-card input:checked~.fc-body .fc-check{opacity:1;transform:scale(1);}
      .fc-emoji{font-size:1.5rem;line-height:1;}
      .fc-name{font-size:.72rem;font-weight:500;color:var(--text,#fff);line-height:1.2;}
      .fc-price{font-size:.68rem;color:#22c55e;font-weight:600;display:none;}
      .carton-box-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:4px 0;width:100%;}
      .carton-label{font-size:.85rem;color:var(--text,#fff);flex:1;min-width:160px;}
      .carton-qty-wrap{display:flex;align-items:center;gap:6px;}
      .carton-price-note{font-size:.8rem;color:#22c55e;font-weight:600;}`;
    document.head.appendChild(s);
  }

  document.addEventListener("change", (e) => {
    if (e.target.type === "checkbox" && e.target.closest(".furniture-card")) {
      e.target.closest(".furniture-card").classList.toggle("checked", e.target.checked);
    }
  });

  if (!document.getElementById("recaptcha-container-signup")) {
    const d = document.createElement("div");
    d.id = "recaptcha-container-signup";
    d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(d);
  }
  if (!document.getElementById("recaptcha-container-reset")) {
    const d = document.createElement("div");
    d.id = "recaptcha-container-reset";
    d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(d);
  }
});

/* ============================================
   PAYMENT OPTIONS
   ============================================ */
function initPaymentOptions() {
  document.getElementById("optAtDrop")?.classList.add("selected");
  document.getElementById("optAdvance")?.classList.remove("selected");
  document.getElementById("optFull")?.classList.remove("selected");
  selectedPayment = "at_drop";
}

/* ============================================
   FIREBASE HELPER
   ============================================ */
function waitForFirebase(cb, tries = 0) {
  if (window._firebase) { cb(); return; }
  if (tries > 30) return;
  setTimeout(() => waitForFirebase(cb, tries + 1), 200);
}

/* ============================================
   NAV
   ============================================ */
function updateNavForUser(user) {
  const loginBtn  = document.getElementById("navLoginBtn");
  const navUser   = document.getElementById("navUser");
  const navAvatar = document.getElementById("navAvatar");
  const navName   = document.getElementById("navUserName");
  const adminLink = document.getElementById("adminNavLink");
  if (adminLink) adminLink.style.display = "none";
  if (user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (navUser)  navUser.style.display  = "flex";
    const name = user.displayName || user.email?.split("@")[0] || "User";
    if (navName)   navName.textContent   = name.split(" ")[0];
    if (navAvatar) navAvatar.textContent = name.charAt(0).toUpperCase();
    window._firebase.db.collection("users").doc(user.uid).get()
      .then(doc => { if (doc.exists && doc.data().role === "admin" && adminLink) adminLink.style.display = "block"; })
      .catch(() => {});
  } else {
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (navUser)  navUser.style.display  = "none";
  }
}

function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  const navUser  = document.getElementById("navUser");
  if (!dropdown || !navUser) return;
  if (dropdown.classList.contains("open")) { dropdown.classList.remove("open"); return; }
  const rect = navUser.getBoundingClientRect();
  dropdown.style.top   = (rect.bottom + 6) + "px";
  dropdown.style.right = (window.innerWidth - rect.right) + "px";
  dropdown.classList.add("open");
}

function closeUserMenu() { document.getElementById("userDropdown")?.classList.remove("open"); }

/* ============================================
   AUTH MODAL
   ============================================ */
function openAuthModal(panel = "login") {
  document.getElementById("authModal").style.display = "flex";
  switchPanel(panel === "login" ? "panelLogin" : "panelSignup");
}

function closeAuthModal() {
  document.getElementById("authModal").style.display = "none";
  clearAuthErrors();
  _clearSignupRecaptcha();
  _clearResetRecaptcha();
  resetFlowPhone                          = "";
  confirmationResult                      = null;
  pendingSignupData                       = null;
  window._resetVerifiedEmail              = null;
  window._resetPhoneUser                  = null;
  window._resetConfirmationVerificationId = null;
  window._resetOtpCode                    = null;
  clearInterval(otpTimerInterval);
}

function switchPanel(id) {
  [
    "panelLogin","panelSignup","panelSignupOTP",
    "panelSetPassword","panelRecover","panelResetOTP","panelResetPassword"
  ].forEach(p => {
    const el = document.getElementById(p);
    if (el) el.style.display = p === id ? "block" : "none";
  });
}

function clearAuthErrors() {
  [
    "loginError","signupError","signupOtpError",
    "setPasswordError","recoverError","resetOtpError","resetPasswordError"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; el.style.color = "#dc2626"; }
  });
}

function showError(id, msg, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === "success" ? "#16a34a" : type === "info" ? "#2563eb" : "#dc2626";
}

function getAuthErrorMessage(code) {
  const map = {
    "auth/user-not-found":            "⚠️ No account found. Please sign up first.",
    "auth/wrong-password":            "⚠️ Incorrect password. Please try again.",
    "auth/invalid-credential":        "⚠️ Incorrect details. Please try again.",
    "auth/invalid-login-credentials": "⚠️ Incorrect details. Please try again.",
    "auth/email-already-in-use":      "⚠️ This email is already registered.",
    "auth/weak-password":             "⚠️ Password too weak. Use at least 6 characters.",
    "auth/network-request-failed":    "⚠️ Network error. Check your connection.",
    "auth/too-many-requests":         "⚠️ Too many attempts. Please wait a few minutes.",
    "auth/invalid-phone-number":      "⚠️ Invalid phone number.",
    "auth/session-expired":           "⚠️ OTP expired. Please request a new one.",
    "auth/invalid-verification-code": "⚠️ Incorrect OTP. Please try again.",
    "auth/quota-exceeded":            "⚠️ SMS quota exceeded. Try again later.",
    "auth/credential-already-in-use": "⚠️ This phone number is already linked to another account.",
  };
  return map[code] || ("⚠️ " + (code || "Something went wrong. Please try again."));
}

/* ─────────────────────────────────────────────
   RECAPTCHA HELPERS
───────────────────────────────────────────── */
function _clearSignupRecaptcha() {
  if (window._signupRecaptcha) {
    try { window._signupRecaptcha.clear(); } catch (e) {}
    window._signupRecaptcha = null;
  }
  const c = document.getElementById("recaptcha-container-signup");
  if (c) c.innerHTML = "";
}

function _clearResetRecaptcha() {
  if (window._resetRecaptcha) {
    try { window._resetRecaptcha.clear(); } catch (e) {}
    window._resetRecaptcha = null;
  }
  const c = document.getElementById("recaptcha-container-reset");
  if (c) c.innerHTML = "";
}

/* ═══════════════════════════════════════════════
   SIGN UP FLOW
═══════════════════════════════════════════════ */
function signupUser() {
  const firstName = document.getElementById("signupFirstName").value.trim();
  const lastName  = document.getElementById("signupLastName").value.trim();
  const phone     = document.getElementById("signupPhone").value.trim();
  const email     = document.getElementById("signupEmail").value.trim();
  const referral  = document.getElementById("signupReferral")?.value.trim().toUpperCase() || "";

  if (!firstName) return showError("signupError", "⚠️ Please enter your first name.");
  if (!lastName)  return showError("signupError", "⚠️ Please enter your last name.");
  if (!/^\d{10}$/.test(phone)) return showError("signupError", "⚠️ Please enter a valid 10-digit mobile number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("signupError", "⚠️ Please enter a valid email address.");

  showError("signupError", "⏳ Sending OTP to +91 " + phone + "...", "info");
  const btn = document.getElementById("btnSignupSendOtp");
  if (btn) { btn.disabled = true; btn.textContent = "Sending OTP..."; }

  pendingSignupData = { firstName, lastName, phone, email, referral };
  _clearSignupRecaptcha();

  waitForFirebase(() => {
    window._signupRecaptcha = new firebase.auth.RecaptchaVerifier(
      "recaptcha-container-signup", { size: "invisible", callback: () => {} }
    );
    window._signupRecaptcha.render().then(() => {
      window._firebase.auth.signInWithPhoneNumber("+91" + phone, window._signupRecaptcha)
        .then(result => {
          confirmationResult = result;
          document.getElementById("signupOtpPhone").textContent = "+91 " + phone;
          switchPanel("panelSignupOTP");
          document.getElementById("signupOtpInput").focus();
          if (btn) { btn.disabled = false; btn.textContent = "Send OTP →"; }
        })
        .catch(err => {
          _clearSignupRecaptcha();
          showError("signupError", getAuthErrorMessage(err.code));
          if (btn) { btn.disabled = false; btn.textContent = "Send OTP →"; }
        });
    }).catch(() => {
      _clearSignupRecaptcha();
      showError("signupError", "⚠️ reCAPTCHA error. Please refresh and try again.");
      if (btn) { btn.disabled = false; btn.textContent = "Send OTP →"; }
    });
  });
}

function verifySignupOTP() {
  const otp = document.getElementById("signupOtpInput").value.trim();
  if (!/^\d{6}$/.test(otp))    return showError("signupOtpError", "⚠️ Please enter the 6-digit OTP.");
  if (!confirmationResult)      return showError("signupOtpError", "⚠️ OTP session expired. Please go back and try again.");

  const btn = document.getElementById("btnVerifySignupOtp");
  if (btn) { btn.disabled = true; btn.textContent = "Verifying..."; }
  showError("signupOtpError", "⏳ Verifying OTP...", "info");

  confirmationResult.confirm(otp)
    .then(result => {
      pendingSignupData.phoneUser = result.user;
      if (btn) { btn.disabled = false; btn.textContent = "Verify OTP →"; }
      switchPanel("panelSetPassword");
      document.getElementById("setPasswordInput").focus();
    })
    .catch(err => {
      showError("signupOtpError", getAuthErrorMessage(err.code));
      if (btn) { btn.disabled = false; btn.textContent = "Verify OTP →"; }
    });
}

async function completeSignup() {
  const password = document.getElementById("setPasswordInput").value;
  const confirm  = document.getElementById("setPasswordConfirm").value;

  if (password.length < 6)  return showError("setPasswordError", "⚠️ Password must be at least 6 characters.");
  if (password !== confirm)  return showError("setPasswordError", "⚠️ Passwords do not match.");
  if (!pendingSignupData?.phoneUser) return showError("setPasswordError", "⚠️ Session expired. Please start again.");

  const btn = document.getElementById("btnCompleteSignup");
  if (btn) { btn.disabled = true; btn.textContent = "Creating account..."; }
  showError("setPasswordError", "⏳ Creating your account...", "info");

  const { firstName, lastName, phone, email, referral, phoneUser } = pendingSignupData;
  const fullName = firstName + " " + lastName;
  const { auth, db } = window._firebase;

  try {
    const emailCred = firebase.auth.EmailAuthProvider.credential(email, password);
    await phoneUser.linkWithCredential(emailCred);
    await phoneUser.updateProfile({ displayName: fullName });

    const refCode = phoneUser.uid.slice(0, 8).toUpperCase();
    await db.collection("users").doc(phoneUser.uid).set({
      firstName, lastName, name: fullName,
      email, phone,
      role: "customer",
      phoneVerified: true,
      prefEmail: true, prefSMS: true,
      referralCode: refCode, referralCount: 0, referralCredits: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (referral) await processReferral(referral, phoneUser.uid);

    pendingSignupData = null;
    _clearSignupRecaptcha();
    closeAuthModal();
    showToast(`👋 Welcome to PackZen, ${firstName}!`);

  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "Create Account →"; }
    if (err.code === "auth/email-already-in-use") {
      showError("setPasswordError", "⚠️ This email is already registered. Please login.");
    } else if (err.code === "auth/credential-already-in-use") {
      showError("setPasswordError", "⚠️ This phone number is already registered.");
    } else {
      showError("setPasswordError", getAuthErrorMessage(err.code));
    }
  }
}

async function processReferral(refCode, newUserUid) {
  try {
    const snap = await window._firebase.db.collection("users").where("referralCode", "==", refCode).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        referralCount:   firebase.firestore.FieldValue.increment(1),
        referralCredits: firebase.firestore.FieldValue.increment(500)
      });
      await window._firebase.db.collection("users").doc(newUserUid)
        .update({ referralDiscount: 500, referredBy: refCode });
    }
  } catch (e) {}
}

function resendSignupOTP() {
  document.getElementById("signupOtpInput").value = "";
  showError("signupOtpError", "");
  switchPanel("panelSignup");
}

/* ═══════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════ */
async function loginUser() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPassword").value;

  if (!email || !pass) return showError("loginError", "⚠️ Enter email and password");

  const btn = document.getElementById("btnLogin");
  if (btn) { btn.disabled = true; btn.textContent = "Signing in..."; }

  waitForFirebase(async () => {
    const { auth } = window._firebase;
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      closeAuthModal();
      showToast("✅ Login successful");
    } catch (err) {
      showError("loginError", "⚠️ Incorrect email or password");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Login →"; }
    }
  });
}

async function _handleGoogleUser(user, db) {
  const userRef     = db.collection("users").doc(user.uid);
  const existingDoc = await userRef.get();
  if (existingDoc.exists) {
    await userRef.update({ lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(), loginMethod: "google" });
    return;
  }
  const emailSnap = await db.collection("users").where("email", "==", user.email).limit(1).get();
  if (!emailSnap.empty) {
    const existingData = emailSnap.docs[0].data();
    const oldDocId     = emailSnap.docs[0].id;
    await userRef.set({ ...existingData, loginMethod: "google", googleLinked: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    if (oldDocId !== user.uid) await db.collection("users").doc(oldDocId).delete().catch(() => {});
  } else {
    const refCode = user.uid.slice(0, 8).toUpperCase();
    await userRef.set({
      name: user.displayName || "", email: user.email || "", phone: user.phoneNumber || "",
      role: "customer", loginMethod: "google", phoneVerified: false,
      prefEmail: true, prefSMS: true,
      referralCode: refCode, referralCount: 0, referralCredits: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

window.signInWithGoogle = async function () {
  waitForFirebase(async () => {
    const { auth, db } = window._firebase;
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await auth.signInWithPopup(provider);
      await _handleGoogleUser(result.user, db);
      closeAuthModal();
      const name = (result.user.displayName || result.user.email?.split("@")[0] || "User").split(" ")[0];
      showToast(`👋 Welcome, ${name}!`);
    } catch (err) {
      if (err.code === "auth/popup-blocked") {
        showError("loginError", "⚠️ Popup blocked — please allow popups for this site and try again.");
      } else if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        // silent
      } else if (err.code === "auth/unauthorized-domain") {
        showError("loginError", "⚠️ Domain not authorized. Add it in Firebase Console → Authentication → Authorized Domains.");
      } else {
        showError("loginError", getAuthErrorMessage(err.code));
      }
    }
  });
};

/* ═══════════════════════════════════════════════
   PASSWORD RESET FLOW
═══════════════════════════════════════════════ */
async function sendResetOTP() {
  const phone = document.getElementById("resetPhone").value.trim();
  if (!/^\d{10}$/.test(phone)) return showError("recoverError", "⚠️ Please enter a valid 10-digit phone number.");

  const btn = document.getElementById("btnSendResetOtp");
  if (btn) { btn.disabled = true; btn.textContent = "Checking..."; }
  showError("recoverError", "⏳ Looking up your account...", "info");

  waitForFirebase(async () => {
    const { auth, db } = window._firebase;
    try {
      const resetEmail = document.getElementById("resetEmail").value.trim();
      if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
        if (btn) { btn.disabled = false; btn.textContent = "Send OTP →"; }
        return showError("recoverError", "⚠️ Please enter a valid email address.");
      }
      const emailSnap = await db.collection("users").where("email", "==", resetEmail).limit(1).get();
      if (emailSnap.empty) {
        if (btn) { btn.disabled = false; btn.textContent = "Send OTP →"; }
        return showError("recoverError", "⚠️ No account found with this email. Please sign up.");
      }
      const userData    = emailSnap.docs[0].data();
      const storedPhone = (userData.phone || "").replace("+91", "").trim();
      if (storedPhone !== phone) {
        if (btn) { btn.disabled = false; btn.textContent = "Send OTP →"; }
        return showError("recoverError", "⚠️ Phone number does not match this email account.");
      }
      resetFlowPhone = phone;
      showError("recoverError", "⏳ Sending OTP to +91 " + phone + "...", "info");
      if (btn) btn.textContent = "Sending OTP...";
      _clearResetRecaptcha();
      window._resetRecaptcha = new firebase.auth.RecaptchaVerifier(
        "recaptcha-container-reset", { size: "invisible", callback: () => {} }
      );
      await window._resetRecaptcha.render();
      confirmationResult = await auth.signInWithPhoneNumber("+91" + phone, window._resetRecaptcha);
      window._resetConfirmationVerificationId = confirmationResult.verificationId;
      document.getElementById("resetOtpPhone").textContent = "+91 " + phone;
      switchPanel("panelResetOTP");
      document.getElementById("resetOtpInput").focus();
      if (btn) { btn.disabled = false; btn.textContent = "Send OTP →"; }
      _startOtpTimer();
    } catch (err) {
      _clearResetRecaptcha();
      if (btn) { btn.disabled = false; btn.textContent = "Send OTP →"; }
      const msg = err.code === "auth/invalid-phone-number"
        ? "⚠️ Invalid phone number."
        : err.code === "auth/too-many-requests"
        ? "⚠️ Too many requests. Please wait a few minutes."
        : "⚠️ Failed to send OTP. Please try again.";
      showError("recoverError", msg);
    }
  });
}

async function verifyResetOTP() {
  const otp = document.getElementById("resetOtpInput").value.trim();
  if (!/^\d{6}$/.test(otp)) return showError("resetOtpError", "⚠️ Please enter the 6-digit OTP.");
  if (!confirmationResult)   return showError("resetOtpError", "⚠️ OTP session expired. Please go back and try again.");

  const btn = document.getElementById("btnVerifyResetOtp");
  if (btn) { btn.disabled = true; btn.textContent = "Verifying..."; }
  showError("resetOtpError", "⏳ Verifying OTP...", "info");

  try {
    const result = await confirmationResult.confirm(otp);
    clearInterval(otpTimerInterval);
    window._resetConfirmationVerificationId = confirmationResult.verificationId;
    window._resetOtpCode   = otp;
    window._resetPhoneUser = result.user;

    const { db } = window._firebase;
    const phone  = resetFlowPhone;
    let verifiedEmail = null;

    const snap1 = await db.collection("users").where("phone", "==", phone).limit(1).get();
    if (!snap1.empty) verifiedEmail = snap1.docs[0].data().email;
    if (!verifiedEmail) {
      const snap2 = await db.collection("users").where("phone", "==", "+91" + phone).limit(1).get();
      if (!snap2.empty) verifiedEmail = snap2.docs[0].data().email;
    }
    if (!verifiedEmail) {
      await window._firebase.auth.signOut().catch(() => {});
      if (btn) { btn.disabled = false; btn.textContent = "Verify OTP →"; }
      return showError("resetOtpError", "⚠️ Account not found. Please contact support.");
    }
    window._resetVerifiedEmail = verifiedEmail;
    if (btn) { btn.disabled = false; btn.textContent = "Verify OTP →"; }
    const np = document.getElementById("newPasswordInput");
    const co = document.getElementById("confirmPasswordInput");
    if (np) np.value = "";
    if (co) co.value = "";
    switchPanel("panelResetPassword");
    np?.focus();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "Verify OTP →"; }
    if (err.code === "auth/invalid-verification-code") {
      showError("resetOtpError", "❌ Incorrect OTP. Please check and try again.");
    } else if (["auth/session-expired","auth/code-expired"].includes(err.code)) {
      showError("resetOtpError", "⚠️ OTP expired. Please go back and request a new one.");
    } else {
      showError("resetOtpError", "⚠️ Verification failed. Please try again.");
    }
  }
}

async function setNewPassword() {
  const newPass  = document.getElementById("newPasswordInput").value;
  const confPass = document.getElementById("confirmPasswordInput").value;

  if (newPass.length < 6)  return showError("resetPasswordError", "⚠️ Password must be at least 6 characters.");
  if (newPass !== confPass) return showError("resetPasswordError", "⚠️ Passwords do not match.");

  const email          = window._resetVerifiedEmail;
  const verificationId = window._resetConfirmationVerificationId;
  const otpCode        = window._resetOtpCode;
  const freshUser      = window._resetPhoneUser;

  if (!email || !freshUser) return showError("resetPasswordError", "⚠️ Session expired. Please restart.");

  const btn = document.getElementById("btnSetNewPassword");
  if (btn) { btn.disabled = true; btn.textContent = "Updating..."; }
  showError("resetPasswordError", "⏳ Updating your password...", "info");

  const auth = window._firebase.auth;

  try {
    let targetUser = freshUser;
    try {
      await targetUser.updatePassword(newPass);
      await _finaliseReset(auth, btn);
      return;
    } catch (firstErr) {
      if (firstErr.code === "auth/requires-recent-login") {
        if (verificationId && otpCode) {
          try {
            const phoneCred = firebase.auth.PhoneAuthProvider.credential(verificationId, otpCode);
            await targetUser.reauthenticateWithCredential(phoneCred);
            await targetUser.reload();
            await targetUser.updatePassword(newPass);
            await _finaliseReset(auth, btn);
            return;
          } catch (reAuthErr) {
            // fall through to email linking
          }
        }
      } else if (firstErr.code !== "auth/no-such-provider") {
        throw firstErr;
      }
    }
    const emailCred = firebase.auth.EmailAuthProvider.credential(email, newPass);
    try {
      await targetUser.linkWithCredential(emailCred);
      await _finaliseReset(auth, btn);
    } catch (linkErr) {
      if (linkErr.code === "auth/provider-already-linked" || linkErr.code === "auth/credential-already-in-use") {
        await targetUser.updatePassword(newPass);
        await _finaliseReset(auth, btn);
      } else if (linkErr.code === "auth/email-already-in-use") {
        showError("resetPasswordError", "⚠️ Unable to update. Please contact support@packzenblr.in");
        if (btn) { btn.disabled = false; btn.textContent = "Set New Password →"; }
      } else {
        throw linkErr;
      }
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "Set New Password →"; }
    if (err.code === "auth/requires-recent-login") {
      showError("resetPasswordError", "⚠️ Session timed out. Please go back and request a new OTP.");
    } else if (err.code === "auth/weak-password") {
      showError("resetPasswordError", "⚠️ Password too weak. Use at least 6 characters.");
    } else if (err.code === "auth/too-many-requests") {
      showError("resetPasswordError", "⚠️ Too many attempts. Please wait a few minutes.");
    } else {
      showError("resetPasswordError", "⚠️ " + (err.code || err.message || "Something went wrong."));
    }
  }
}

/* ============================================
   TOAST
   ============================================ */
function showToast(msg, dur = 3000) {
  let t = document.getElementById("toastMsg");
  if (!t) {
    t = document.createElement("div");
    t.id = "toastMsg";
    t.className = "toast-msg";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove("show"), dur);
}

/* ============================================
   DASHBOARD
   ============================================ */
function prefillBookingForm(userData) {
  const nameEl  = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  if (nameEl  && !nameEl.value.trim()  && userData?.name)  nameEl.value  = userData.name;
  if (phoneEl && !phoneEl.value.trim() && userData?.phone) phoneEl.value = userData.phone.replace("+91","").trim();
}

async function openDashboard() {
  document.getElementById("userDropdown")?.classList.remove("open");
  if (!currentUser) { openAuthModal("login"); return; }
  if (!window._firebase) return;
  const { db } = window._firebase;
  try {
    const userSnap = await db.collection("users").doc(currentUser.uid).get();
    const userData = userSnap.data() || {};
    const name     = currentUser.displayName || "User";
    document.getElementById("dashName").textContent   = name;
    document.getElementById("dashEmail").textContent  = currentUser.email || "";
    document.getElementById("dashAvatar").textContent = name.charAt(0).toUpperCase();
    const adminTabBtn = document.getElementById("adminTabBtn");
    if (userData.role === "admin" && adminTabBtn) adminTabBtn.style.display = "inline-flex";
    await loadQuotes();
    document.getElementById("dashboardModal").style.display = "flex";
    switchDashTab("quotes", document.querySelector(".dash-tab"));
  } catch (e) { console.error("Dashboard error:", e); }
}

async function loadQuotes() {
  if (!window._firebase || !currentUser) return;
  const db        = window._firebase.db;
  const container = document.getElementById("quotesList");
  if (!container) return;
  container.innerHTML = "⏳ Loading your quotes...";
  try {
    const snapshot = await db.collection("quotes").where("uid", "==", currentUser.uid).orderBy("createdAt", "desc").get();
    if (snapshot.empty) {
      container.innerHTML = `<div style="opacity:0.7;text-align:center;padding:20px;">No quotes found yet 🚚</div>`;
      return;
    }
    container.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      container.innerHTML += `
        <div style="padding:12px;margin-bottom:12px;border:1px solid #333;border-radius:10px;background:#0f172a;">
          <div style="font-weight:600;">${data.pickup||"N/A"} → ${data.drop||"N/A"}</div>
          <div style="margin-top:6px;">💰 ₹${data.total||0}</div>
          <div style="font-size:12px;opacity:0.7;">📅 ${data.date||""}</div>
        </div>`;
    });
  } catch (error) {
    container.innerHTML = "❌ Failed to load quotes";
  }
}

/* ============================================
   REFERRAL
   ============================================ */
async function loadReferralData() {
  if (!currentUser || !window._firebase) return;
  const snap = await window._firebase.db.collection("users").doc(currentUser.uid).get().catch(() => null);
  if (!snap?.exists) return;
  const d    = snap.data();
  const code = d.referralCode || currentUser.uid.slice(0, 8).toUpperCase();
  document.getElementById("referralCodeText").textContent = code;
  document.getElementById("refCount").textContent     = d.referralCount   || 0;
  document.getElementById("refEarned").textContent    = "₹" + (d.referralCredits || 0);
  document.getElementById("refAvailable").textContent = "₹" + (d.referralCredits || 0);
}

function copyReferralCode() {
  const code = document.getElementById("referralCodeText").textContent;
  navigator.clipboard.writeText(code).then(() => showToast("✅ Referral code copied!"));
}

/* ============================================
   PROMO CODE
   ============================================ */
async function applyPromoCode() {
  const code  = document.getElementById("promoInput").value.trim().toUpperCase();
  const msgEl = document.getElementById("promoMsg");
  if (!code) { msgEl.textContent = "Enter a promo code."; msgEl.className = "promo-msg promo-error"; return; }
  waitForFirebase(async () => {
    const { db } = window._firebase;
    try {
      const snap = await db.collection("promos").doc(code).get();
      if (!snap.exists) {
        const refSnap = await db.collection("users").where("referralCode","==",code).get();
        if (!refSnap.empty && currentUser && refSnap.docs[0].id !== currentUser.uid) {
          promoDiscount = 500;
          msgEl.textContent = "🎉 Referral code applied! ₹500 discount.";
          msgEl.className = "promo-msg promo-success";
          updatePriceDisplay(); return;
        }
        msgEl.textContent = "Invalid promo code."; msgEl.className = "promo-msg promo-error"; return;
      }
      const promo    = snap.data();
      if (!promo.active) { msgEl.textContent = "This promo has expired."; msgEl.className = "promo-msg promo-error"; return; }
      const discount = promo.type === "percent" ? Math.round(lastCalculatedTotal * promo.value / 100) : promo.value;
      promoDiscount  = Math.min(discount, lastCalculatedTotal * 0.5);
      msgEl.textContent = `🎉 Code applied! ₹${promoDiscount} off.`;
      msgEl.className = "promo-msg promo-success";
      updatePriceDisplay();
    } catch(e) { msgEl.textContent = "Error checking code."; msgEl.className = "promo-msg promo-error"; }
  });
}

/* ============================================
   PRICE DISPLAY
   ============================================ */
function updatePriceDisplay() {
  const priceEl   = document.getElementById("livePrice");
  const advanceEl = document.getElementById("advanceAmount");
  const discRow   = document.getElementById("discountRow");
  const discAmt   = document.getElementById("discountAmt");
  const optAdv    = document.getElementById("optAdvanceAmt");
  const optFull   = document.getElementById("optFullAmt");
  const optAtDrop = document.getElementById("optAtDropAmt");
  if (!priceEl) return;
  const discounted = Math.max(lastCalculatedTotal - promoDiscount, 0);
  const fullAmt    = Math.round(discounted * 0.93);
  const advanceAmt = Math.round(discounted * 0.10);
  priceEl.textContent = "₹" + discounted.toLocaleString("en-IN");
  if (advanceEl) advanceEl.textContent = "₹" + advanceAmt.toLocaleString("en-IN");
  if (optAdv)    optAdv.textContent    = "₹" + advanceAmt.toLocaleString("en-IN");
  if (optFull)   optFull.textContent   = "₹" + fullAmt.toLocaleString("en-IN");
  if (optAtDrop) optAtDrop.textContent = "₹" + discounted.toLocaleString("en-IN");
  if (promoDiscount > 0 && discRow) {
    discRow.style.display = "block";
    if (discAmt) discAmt.textContent = "₹" + promoDiscount.toLocaleString("en-IN");
  }
  syncPayOnlineButton(discounted, advanceAmt, fullAmt);
}

function syncPayOnlineButton(total, advanceAmt, fullAmt) {
  const btn = document.getElementById("btnPayOnline");
  if (!btn) return;
  if (selectedPayment === "advance")      btn.innerHTML = `💳 Pay Advance ₹${advanceAmt.toLocaleString("en-IN")} Online`;
  else if (selectedPayment === "full")    btn.innerHTML = `💳 Pay Full ₹${fullAmt.toLocaleString("en-IN")} (Save 7%)`;
  else                                    btn.innerHTML = `💳 Pay Online`;
}

function selectPayment(type) {
  selectedPayment = type;
  ["optAdvance","optFull","optAtDrop"].forEach(id => document.getElementById(id)?.classList.remove("selected"));
  document.getElementById({ advance:"optAdvance", full:"optFull", at_drop:"optAtDrop" }[type])?.classList.add("selected");
  const discounted = Math.max(lastCalculatedTotal - promoDiscount, 0);
  syncPayOnlineButton(discounted, Math.round(discounted * 0.10), Math.round(discounted * 0.93));
}

function startRazorpayPayment() { startPayment(); }

/* ============================================
   PHOTO UPLOAD
   ============================================ */
function previewPhotos(input) {
  const previews = document.getElementById("photoPreviews");
  previews.innerHTML = ""; uploadedPhotos = [];
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      uploadedPhotos.push(e.target.result);
      const img = document.createElement("img");
      img.src = e.target.result; img.className = "photo-thumb";
      previews.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

/* ============================================
   SAVE QUOTE
   ============================================ */
async function saveQuoteToFirestore(total) {
  if (!currentUser || !window._firebase) return;
  const { db }    = window._firebase;
  const houseEl   = document.getElementById("house");
  const vehicleEl = document.getElementById("vehicle");
  try {
    await db.collection("quotes").add({
      uid:     currentUser.uid,
      pickup:  document.getElementById("pickup")?.value  || "",
      drop:    document.getElementById("drop")?.value    || "",
      house:   houseEl?.options[houseEl?.selectedIndex]?.text    || "",
      vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text || "",
      total, date: new Date().toLocaleDateString("en-IN"),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e) {}
}

/* ============================================
   GOOGLE MAPS
   ============================================ */
function initAutocomplete() {
  const pickupInput = document.getElementById("pickup");
  const dropInput   = document.getElementById("drop");
  const pickupAuto  = new google.maps.places.Autocomplete(pickupInput);
  const dropAuto    = new google.maps.places.Autocomplete(dropInput);
  pickupAuto.addListener("place_changed", () => { pickupPlace = pickupAuto.getPlace(); showLocation("pickup"); calculateQuote(true); });
  dropAuto.addListener("place_changed",   () => { dropPlace   = dropAuto.getPlace();   showLocation("drop");   calculateQuote(true); });

  const toggle = document.getElementById("useCurrentLocation");
  if (toggle) {
    toggle.addEventListener("change", () => {
      if (!toggle.checked) return;
      if (!navigator.geolocation) { showToast("⚠️ Location not supported."); toggle.checked = false; return; }
      pickupInput.value = "📍 Getting your location...";
      navigator.geolocation.getCurrentPosition(
        pos => {
          const latLng = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
          new google.maps.Geocoder().geocode({ location: latLng }, (res, status) => {
            if (status === "OK" && res[0]) {
              pickupInput.value = res[0].formatted_address;
              pickupPlace = { geometry: { location: latLng } };
              showLocation("pickup"); calculateQuote(true);
            } else { pickupInput.value = ""; toggle.checked = false; showToast("⚠️ Could not get address."); }
          });
        },
        err => { pickupInput.value = ""; toggle.checked = false; showToast("❌ " + err.message); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
  attachAutoCalculation();
}

function attachAutoCalculation() {
  ["house","vehicle","pickupFloor","dropFloor","liftAvailable","cartonQty"].forEach(id =>
    document.getElementById(id)?.addEventListener("change", () => calculateQuote(true))
  );
  document.querySelector(".furniture-grid")?.addEventListener("change", () => calculateQuote(true));
}

function showLocation(type) {
  const mapDiv = document.getElementById("map");
  const place  = type === "pickup" ? pickupPlace : dropPlace;
  if (!place?.geometry) return;
  const loc = place.geometry.location;
  if (!map) {
    mapDiv.style.display = "block"; mapDiv.style.height = "200px"; mapDiv.style.maxHeight = "200px";
    map = new google.maps.Map(mapDiv, { center: loc, zoom: 14 });
    directionsService  = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map, suppressMarkers: true });
  }
  map.setCenter(loc);
  if (type === "pickup") {
    if (pickupMarker) pickupMarker.setMap(null);
    pickupMarker = new google.maps.Marker({ map, position: loc, draggable: true, label: "P" });
    pickupMarker.addListener("dragend", () => updateAddress("pickup", pickupMarker.getPosition()));
  } else {
    if (dropMarker) dropMarker.setMap(null);
    dropMarker = new google.maps.Marker({ map, position: loc, draggable: true, label: "D" });
    dropMarker.addListener("dragend", () => updateAddress("drop", dropMarker.getPosition()));
  }
  adjustBounds();
}

function updateAddress(type, latlng) {
  new google.maps.Geocoder().geocode({ location: latlng }, (res, status) => {
    if (status === "OK" && res[0]) {
      document.getElementById(type).value = res[0].formatted_address;
      if (type === "pickup") pickupPlace = { geometry: { location: latlng } };
      else                   dropPlace   = { geometry: { location: latlng } };
      adjustBounds(); calculateQuote(true);
    }
  });
}

function adjustBounds() {
  if (!map) return;
  const bounds = new google.maps.LatLngBounds();
  if (pickupPlace?.geometry) bounds.extend(pickupPlace.geometry.location);
  if (dropPlace?.geometry)   bounds.extend(dropPlace.geometry.location);
  if (!bounds.isEmpty()) map.fitBounds(bounds);
  if (pickupPlace && dropPlace) {
    directionsService.route({
      origin: pickupPlace.geometry.location, destination: dropPlace.geometry.location, travelMode: "DRIVING"
    }, (res, status) => { if (status === "OK") directionsRenderer.setDirections(res); });
  }
}

/* ============================================
   INTERCITY PRICING TABLE
   ============================================ */
let isIntercityMove = false;
const INTERCITY_PRICING = {
  "1750": {"400":9000,"600":10800,"1000":17100,"2000":24000},
  "3950": {"400":9000,"600":10800,"1000":17100,"2000":24000},
  "5750": {"400":11000,"600":13200,"1000":20900,"2000":28000},
  "7450": {"400":13000,"600":15600,"1000":24700,"2000":33000},
  "8350": {"400":15500,"600":18600,"1000":29450,"2000":38000},
  "10800":{"400":18000,"600":21600,"1000":34000,"2000":45000},
  "5400": {"400":10000,"600":12000,"1000":19000,"2000":26000},
  "8800": {"400":15000,"600":18000,"1000":28000,"2000":38000},
  "13700":{"400":22000,"600":26000,"1000":40000,"2000":55000},
  "21550":{"400":35000,"600":42000,"1000":65000,"2000":90000}
};

function getIntercityBase(houseVal, km) {
  const tiers = INTERCITY_PRICING[String(houseVal)];
  if (!tiers) return 15000;
  return km <= 400 ? tiers["400"] : km <= 600 ? tiers["600"] : km <= 1000 ? tiers["1000"] : tiers["2000"];
}

function detectAndShowIntercityBadge(km) {
  const badge = document.getElementById("intercityBadge");
  isIntercityMove = km > 100;
  if (badge) {
    badge.style.display = isIntercityMove ? "flex" : "none";
    if (isIntercityMove) badge.querySelector(".ic-km").textContent = Math.round(km) + " km";
  }
  const vg = document.getElementById("vehicleCardGroup");
  if (vg) vg.style.display = isIntercityMove ? "none" : "block";
}

/* ============================================
   PRICE CALCULATION  ← MAIN FIX HERE
   ============================================ */
function calculateQuote(auto = false) {
  const pickup  = document.getElementById("pickup");
  const drop    = document.getElementById("drop");
  const house   = document.getElementById("house");
  const vehicle = document.getElementById("vehicle");
  const result  = document.getElementById("result");

if (!pickup?.value || !drop?.value) {

  // ✅ Allow single item without location
  if (hasItems && !houseBase && !vehicleRate) {
    const total = 499 + furnitureCost;

    lastCalculatedTotal = total;
    updatePriceDisplay();

    if (result) {
      result.innerHTML = `
        🪑 Single Item Move<br>
        Base: ₹499 + Items: ₹${furnitureCost}<br>
        <strong>Total: ₹${total}</strong>
      `;
    }

    return;
  }

  if (!auto) showToast("📍 Please enter pickup & drop locations.");
  return;
}

  // Count chargeable items
  const chargedItems = ["sofaCheck","tvCheck","tvUnitCheck","coffeeCheck","acCheck","bedCheck","wardrobeCheck","dressingCheck","sideTableCheck"];
  let itemCount = 0;
  chargedItems.forEach(id => { if (document.getElementById(id)?.checked) itemCount++; });
  const cartonQty    = parseInt(document.getElementById("cartonQty")?.value || 0);
  const furnitureCost = (itemCount * 150) + (cartonQty * 50);
  const hasItems      = itemCount > 0 || cartonQty > 0;
  const houseBase     = Number(house?.value   || 0);
  const vehicleRate   = Number(vehicle?.value || 0);

  // ── SINGLE ITEM without house/vehicle selected ──
  if (!houseBase && !vehicleRate && hasItems) {
    const total = 499 + furnitureCost;
    lastCalculatedTotal = total;
    updatePriceDisplay();
    if (result) result.innerHTML = `🪑 Single Item Move<br>Base: ₹499 + Items: ₹${furnitureCost}<br><strong>Total: ₹${total}</strong>`;
    return;
  }

  // ── NEEDS DISTANCE — call Distance Matrix, do pricing inside callback ──
  function applyPrice(km) {
    // Now km is properly scoped inside this callback
    detectAndShowIntercityBadge(km);

    const pickupFloor = Number(document.getElementById("pickupFloor")?.value || 0);
    const dropFloor   = Number(document.getElementById("dropFloor")?.value   || 0);
    const liftAvail   = document.getElementById("liftAvailable")?.checked;
    const floorCost   = liftAvail
      ? Math.round((pickupFloor + dropFloor) * 0.5)
      : (pickupFloor + dropFloor);

    let total, breakdownHtml;

    if (km > 100) {
      // ── INTERCITY ──
      const baseRate  = getIntercityBase(house?.value || "3950", km);
      total           = Math.round(baseRate + furnitureCost + floorCost);
      const distLabel = km <= 400 ? "up to 400 km"
                      : km <= 600 ? "up to 600 km"
                      : km <= 1000 ? "up to 1000 km"
                      : "1000+ km";
      breakdownHtml =
        `🚛 Intercity · ~${Math.round(km)} km (${distLabel})<br>` +
        `Base: ₹${baseRate.toLocaleString("en-IN")}` +
        (itemCount  ? ` · Items: ₹${(itemCount * 150).toLocaleString("en-IN")}`   : "") +
        (cartonQty  ? ` · Cartons: ₹${(cartonQty * 50).toLocaleString("en-IN")}` : "") +
        (floorCost  ? ` · Floor: ₹${floorCost.toLocaleString("en-IN")}`           : "") +
        `<br><strong>Total Estimate: ₹${total.toLocaleString("en-IN")}</strong>`;
    } else {
      // ── LOCAL ──
      const vv = Number(vehicle?.value || 0);
      let baseFare = 1999, perKmRate = 25;
      if      (vv === 88) { baseFare = 7500; perKmRate = 40; }
      else if (vv === 69) { baseFare = 6000; perKmRate = 35; }
      else if (vv === 54) { baseFare = 4500; perKmRate = 35; }

      const distanceFare = km <= 25
        ? baseFare
        : baseFare + ((km - 25) * perKmRate);

      total = Math.round(distanceFare + furnitureCost + floorCost);
      breakdownHtml =
        `📍 Local · ~${km.toFixed(1)} km<br>` +
        `Base fare: ₹${baseFare.toLocaleString("en-IN")}` +
        (km > 25    ? ` · Extra km: ₹${Math.round((km - 25) * perKmRate).toLocaleString("en-IN")}` : "") +
        (itemCount  ? ` · Items: ₹${(itemCount * 150).toLocaleString("en-IN")}`                    : "") +
        (cartonQty  ? ` · Cartons: ₹${(cartonQty * 50).toLocaleString("en-IN")}`                   : "") +
        (floorCost  ? ` · Floor: ₹${floorCost.toLocaleString("en-IN")}`                            : "") +
        `<br><strong>Total Estimate: ₹${total.toLocaleString("en-IN")}</strong>`;
    }

    if (result) result.innerHTML = breakdownHtml;
    lastCalculatedTotal = total;
    updatePriceDisplay();
    if (currentUser) saveQuoteToFirestore(total);
  }

  // ── Distance Matrix call ──
  try {
    new google.maps.DistanceMatrixService().getDistanceMatrix({
      origins:      [pickup.value],
      destinations: [drop.value],
      travelMode:   "DRIVING"
    }, (res, status) => {
      const el = res?.rows?.[0]?.elements?.[0];
      if (status === "OK" && el?.status === "OK" && el?.distance?.value) {
        applyPrice(el.distance.value / 1000);
      } else {
        // Fallback: straight-line × 1.3
        if (pickupPlace?.geometry && dropPlace?.geometry) {
          const R    = 6371;
          const p1   = pickupPlace.geometry.location;
          const p2   = dropPlace.geometry.location;
          const lat1 = p1.lat() * Math.PI / 180;
          const lat2 = p2.lat() * Math.PI / 180;
          const dLat = lat2 - lat1;
          const dLng = (p2.lng() - p1.lng()) * Math.PI / 180;
          const a    = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
          applyPrice(Math.max(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3, 5));
        } else {
          applyPrice(15);
        }
      }
    });
  } catch(e) {
    applyPrice(15);
  }
}

/* ============================================
   WHATSAPP BOOKING
   ============================================ */
function saveLead() {
  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec", {
    method: "POST",
    body: JSON.stringify({
      name:   document.getElementById("custName")?.value||"",
      phone:  document.getElementById("custPhone")?.value||"",
      pickup: document.getElementById("pickup")?.value||"",
      drop:   document.getElementById("drop")?.value||""
    })
  }).catch(() => {});
}

async function bookOnWhatsApp() {
  if (!currentUser) { showToast("👋 Please login or create an account to book."); openAuthModal("login"); return; }
  if (!document.getElementById("tncAccepted")?.checked) { showToast("⚠️ Please accept the Terms & Conditions to continue."); return; }
  const name  = document.getElementById("custName")?.value?.trim();
  const phone = document.getElementById("custPhone")?.value?.trim();
  if (!name)                       return showToast("⚠️ Please enter your name.");
  if (!phone || phone.length < 10) return showToast("⚠️ Please enter a valid phone number.");
  if (lastCalculatedTotal === 0)   return showToast("⚠️ Price not calculated yet.");
  saveLead();
  const pickup     = document.getElementById("pickup")?.value  || "";
  const drop       = document.getElementById("drop")?.value    || "";
  const date       = document.getElementById("shiftDate")?.value || "";
  const houseEl    = document.getElementById("house");
  const vehicleEl  = document.getElementById("vehicle");
  const houseText  = houseEl?.options[houseEl?.selectedIndex]?.text    || "";
  const vehicleText= vehicleEl?.options[vehicleEl?.selectedIndex]?.text || "";
  const bookingRef = "WA-" + Date.now().toString(36).toUpperCase();
  const discountedTotal = Math.max(lastCalculatedTotal - promoDiscount, 0);
  if (window._firebase) {
    try {
      showToast("⏳ Saving booking...");
      const docRef = await window._firebase.db.collection("bookings").add({
        bookingRef, customerUid: currentUser.uid, customerName: name, phone, pickup, drop, date,
        moveType: selectedMoveType, house: houseText, vehicle: vehicleText,
        furniture: getFurnitureSummary(),
        pickupFloor:   document.getElementById("pickupFloor")?.options[document.getElementById("pickupFloor")?.selectedIndex]?.text||"",
        dropFloor:     document.getElementById("dropFloor")?.options[document.getElementById("dropFloor")?.selectedIndex]?.text||"",
        liftAvailable: !!document.getElementById("liftAvailable")?.checked,
        packingService: false, total: discountedTotal, originalTotal: lastCalculatedTotal,
        paid: 0, status: "confirmed", source: "whatsapp", promoDiscount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      currentBookingId = docRef.id;
      localStorage.setItem("packzen_active_booking", docRef.id);
      queueSMS(phone, "booking_confirmed", { name, bookingRef, date, pickup, total: discountedTotal });
      notifyOwner(bookingRef, name, phone, pickup, drop, date, discountedTotal, "pay_later", "whatsapp");
      showConfirmationCard({ bookingRef, name, phone, pickup, drop, date, house: houseText||"—", vehicle: vehicleText||"—", total: discountedTotal, paymentLabel: "Cash on moving day", paymentNote: "Our team will confirm your slot shortly", source: "whatsapp", showInvoice: false });
      pendingWhatsAppMsg = `✅ *New Booking — PackZen*\n━━━━━━━━━━━━━━━━━━━━\n🔖 *Booking ID:* ${bookingRef}\n👤 *Name:* ${name}\n📞 *Phone:* ${phone}\n📍 *Pickup:* ${pickup}\n🏁 *Drop:* ${drop}\n📅 *Date:* ${date||"TBD"}\n🏠 *House:* ${houseText||"—"}\n🚚 *Vehicle:* ${vehicleText||"—"}\n💰 *Estimate:* ₹${discountedTotal.toLocaleString("en-IN")}\n━━━━━━━━━━━━━━━━━━━━\nPayment: Cash on moving day`;
      pendingAdminMsg = pendingWhatsAppMsg;
    } catch(e) { showToast("❌ Booking save failed: " + e.message); }
  }
}

/* ============================================
   RAZORPAY
   ============================================ */
function startPayment() {
  if (!currentUser) { showToast("👋 Please login to book."); openAuthModal("login"); return; }
  if (!document.getElementById("tncAccepted")?.checked) { showToast("⚠️ Please accept the Terms & Conditions."); return; }
  const name  = document.getElementById("custName")?.value?.trim();
  const phone = document.getElementById("custPhone")?.value?.trim();
  if (!name)                       return showToast("⚠️ Please enter your name.");
  if (!phone || phone.length < 10) return showToast("⚠️ Please enter a valid phone number.");
  if (lastCalculatedTotal === 0)   return showToast("⚠️ Price not calculated yet.");
  if (!RAZORPAY_KEY)               { showToast("⚠️ Payment not configured."); return; }
  const discounted = Math.max(lastCalculatedTotal - promoDiscount, 0);
  if (selectedPayment === "at_drop") { bookWithoutPayment(); return; }
  const payAmount = selectedPayment === "full"
    ? Math.round(discounted * 0.93)
    : Math.round(discounted * 0.10);
  paymentReceiptId = "PKZ-" + Date.now();
  const rzp = new Razorpay({
    key: RAZORPAY_KEY, amount: payAmount * 100, currency: "INR",
    name: "PackZen Packers & Movers",
    description: selectedPayment === "full" ? "Full Payment (7% off)" : `Advance 10%`,
    receipt: paymentReceiptId, prefill: { name, contact: phone }, theme: { color: "#ea580c" },
    handler:    (response) => onPaymentSuccess(response, name, phone, payAmount, discounted),
    modal:      { ondismiss: () => {} }
  });
  rzp.open();
  rzp.on("payment.failed", r => showToast("❌ Payment failed: " + r.error.description));
}

function onPaymentSuccess(response, name, phone, paid, total) {
  const pickup    = document.getElementById("pickup");
  const drop      = document.getElementById("drop");
  const shiftDate = document.getElementById("shiftDate");
  const houseEl   = document.getElementById("house");
  const vehicleEl = document.getElementById("vehicle");
  const bookingRef = "PKZ-" + Date.now().toString(36).toUpperCase();
  showConfirmationCard({
    bookingRef, name, phone,
    pickup:  pickup?.value||"—", drop: drop?.value||"—", date: shiftDate?.value||"TBD",
    house:   houseEl?.options[houseEl?.selectedIndex]?.text||"—",
    vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text||"—",
    total, paymentLabel: selectedPayment === "full"
      ? `Paid Full — ₹${paid.toLocaleString("en-IN")}`
      : `Advance ₹${paid.toLocaleString("en-IN")} paid`,
    paymentNote: `Payment ID: ${response.razorpay_payment_id}`, source: "payment", showInvoice: true
  });
  if (window._firebase) {
    window._firebase.db.collection("bookings").add({
      bookingRef, customerUid: currentUser.uid, customerName: name, phone,
      pickup: pickup?.value||"", drop: drop?.value||"", moveType: selectedMoveType,
      house:   houseEl?.options[houseEl?.selectedIndex]?.text||"",
      vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text||"",
      furniture: getFurnitureSummary(),
      pickupFloor: document.getElementById("pickupFloor")?.options[document.getElementById("pickupFloor")?.selectedIndex]?.text||"",
      dropFloor:   document.getElementById("dropFloor")?.options[document.getElementById("dropFloor")?.selectedIndex]?.text||"",
      liftAvailable: !!document.getElementById("liftAvailable")?.checked,
      packingService: false, total, originalTotal: lastCalculatedTotal,
      paid, paymentType: selectedPayment, promoDiscount,
      date: shiftDate?.value||"", status: "confirmed", source: "payment",
      isIntercity: isIntercityMove, paymentId: response.razorpay_payment_id,
      photos: uploadedPhotos.slice(0,3),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(docRef => {
      currentBookingId = docRef.id;
      localStorage.setItem("packzen_active_booking", docRef.id);
      requestPushPermission();
      subscribeToBookingNotifications(docRef.id);
      queueSMS(phone, "booking_confirmed", { name, bookingRef, date: shiftDate?.value||"TBD", pickup: pickup?.value||"", total });
      notifyOwner(bookingRef, name, phone, pickup?.value||"—", drop?.value||"—", shiftDate?.value||"TBD", total, selectedPayment, "online");
    }).catch(() => {});
  }
}

function downloadInvoice() {
  if (typeof window.jspdf === "undefined") { showToast("⚠️ PDF library loading..."); return; }
  const { jsPDF }   = window.jspdf;
  const doc         = new jsPDF();
  const bookingId   = document.getElementById("bookingIdDisplay")?.textContent || "—";
  const lines = [
    "Customer : " + (document.getElementById("ccName")?.textContent||"—"),
    "Phone    : " + (document.getElementById("ccPhone")?.textContent||"—"),
    "Pickup   : " + (document.getElementById("ccPickup")?.textContent||"—"),
    "Drop     : " + (document.getElementById("ccDrop")?.textContent||"—"),
    "Date     : " + (document.getElementById("ccDate")?.textContent||"—"),
    "House    : " + (document.getElementById("ccHouse")?.textContent||"—"),
    "Vehicle  : " + (document.getElementById("ccVehicle")?.textContent||"—"),
    "Payment  : " + (document.getElementById("ccPayment")?.textContent||"—"),
    "Amount   : " + (document.getElementById("ccAmount")?.textContent||"₹0"),
  ];
  doc.setFillColor(234,88,12); doc.rect(0,0,210,30,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont("helvetica","bold");
  doc.text("PackZen Packers & Movers",14,15);
  doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text("GST Invoice",14,22);
  doc.setTextColor(0,0,0); doc.setFontSize(11);
  doc.text("Invoice No: " + bookingId, 14, 42);
  doc.text("Date: " + new Date().toLocaleDateString("en-IN"), 14, 50);
  let y = 66;
  lines.forEach(line => { doc.text(line, 14, y); y += 9; });
  doc.save("PackZen-Invoice-" + bookingId + ".pdf");
}

function sendWhatsAppAfterPayment() {
  if (pendingWhatsAppMsg) {
    window.open(`https://wa.me/919945095453?text=${encodeURIComponent(pendingWhatsAppMsg)}`, "_blank");
    if (pendingAdminMsg && pendingAdminMsg !== pendingWhatsAppMsg) {
      setTimeout(() => { window.open(`https://wa.me/919945095453?text=${encodeURIComponent(pendingAdminMsg)}`, "_blank"); }, 800);
    }
    pendingWhatsAppMsg = null;
    pendingAdminMsg    = null;
    return;
  }
  const name  = document.getElementById("custName")?.value?.trim() || "—";
  const phone = document.getElementById("custPhone")?.value?.trim() || "";
  const id    = document.getElementById("bookingIdDisplay")?.textContent || "—";
  const msg   = `✅ *Booking Confirmed — PackZen* 🚚\n\n📌 *ID:* ${id}\n👤 *Name:* ${name}\n💰 *Total:* ₹${lastCalculatedTotal.toLocaleString("en-IN")}\n\n— PackZen | 📞 9945095453`;
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
}

/* ============================================
   CONFIRMATION CARD
   ============================================ */
function showConfirmationCard({ bookingRef, name, phone, pickup, drop, date, house, vehicle, total, paymentLabel, paymentNote, source, showInvoice }) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("bookingIdDisplay", bookingRef||"—");
  set("ccTitle",   source === "whatsapp" ? "Request Sent!" : "Booking Confirmed!");
  set("ccSubtitle",source === "whatsapp" ? "Our team will call you shortly." : "We'll call you within 30 minutes.");
  set("ccPickupShort", (pickup||"—").split(",")[0]);
  set("ccDropShort",   (drop||"—").split(",")[0]);
  set("ccDate",    date||"TBD");
  set("ccAmount",  "₹" + (total||0).toLocaleString("en-IN"));
  set("ccPriceNote", paymentNote||"Pay on delivery");
  set("ccPickup",  pickup||"—"); set("ccDrop", drop||"—");
  set("ccName",    name||"—");   set("ccPhone", phone||"—");
  set("ccHouse",   house||"—");  set("ccVehicle", vehicle||"—");
  set("ccPayment", paymentLabel||"Pay on delivery");
  const invBtn = document.getElementById("btnInvoice");
  if (invBtn) invBtn.style.display = showInvoice ? "flex" : "none";
  const fullDetails = document.getElementById("ccFullDetails");
  const expandBtn   = document.getElementById("ccExpandBtn");
  if (fullDetails) fullDetails.style.display = "none";
  if (expandBtn)   expandBtn.textContent = "View Full Details ↓";
  document.getElementById("paymentModal").style.display = "flex";
}

function toggleConfirmDetails() {
  const fullDetails = document.getElementById("ccFullDetails");
  const expandBtn   = document.getElementById("ccExpandBtn");
  if (!fullDetails) return;
  const isOpen = fullDetails.style.display !== "none";
  fullDetails.style.display = isOpen ? "none" : "block";
  if (expandBtn) expandBtn.textContent = isOpen ? "View Full Details ↓" : "Hide Details ↑";
}

function closeModal() {
  document.getElementById("paymentModal").style.display = "none";
  if (currentBookingId) { showBookingSuccessState(); showTrackOrderBanner(); }
}

function showBookingSuccessState() {
  document.querySelectorAll(".form-step").forEach(s => s.style.display = "none");
  const successEl = document.getElementById("bookingSuccessState");
  if (successEl) successEl.style.display = "block";
  const stepHeader = document.querySelector(".step-header");
  if (stepHeader) stepHeader.style.display = "none";
  const bsId = document.getElementById("bsBookingId");
  if (bsId) bsId.textContent = document.getElementById("bookingIdDisplay")?.textContent || "—";
}

function scrollToTrackBanner() {
  const banner = document.getElementById("trackOrderBanner");
  if (banner) {
    const navH = document.querySelector("nav")?.offsetHeight || 65;
    window.scrollTo({ top: banner.getBoundingClientRect().top + window.scrollY - navH - 8, behavior: "smooth" });
  }
}

function startNewBooking() {
  const successEl = document.getElementById("bookingSuccessState");
  if (successEl) successEl.style.display = "none";
  document.querySelectorAll(".form-step").forEach(s => s.style.display = "");
  const stepHeader = document.querySelector(".step-header");
  if (stepHeader) stepHeader.style.display = "";
  resetBookingForm();
}

function resetBookingForm() {
  currentStep = 0; showStep(0);
  ["pickup","drop","house","vehicle","moveType"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  ["custName","custPhone"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.querySelectorAll(".move-type-card, .select-card, .vehicle-card").forEach(c => c.classList.remove("selected"));
  selectedMoveType = null;
  const mapDiv = document.getElementById("map");
  if (mapDiv) { mapDiv.style.display = "none"; mapDiv.style.height = "0"; }
  promoDiscount = 0; lastCalculatedTotal = 0;
  updatePriceDisplay(); initPaymentOptions();
  setTimeout(() => renderSizeCards("home"), 100);
}

function showTrackOrderBanner() {
  const banner = document.getElementById("trackOrderBanner");
  if (!banner) return;
  const tobId = document.getElementById("tobBookingId");
  if (tobId) tobId.textContent = document.getElementById("bookingIdDisplay")?.textContent || "—";
  banner.style.display = "block";
  setTimeout(() => {
    const quoteSection = document.getElementById("quote");
    if (quoteSection) {
      const navH = document.querySelector("nav")?.offsetHeight || 65;
      window.scrollTo({ top: quoteSection.getBoundingClientRect().top + window.scrollY - navH - 10, behavior: "smooth" });
    }
  }, 200);
  startBannerTracking();
}

function startBannerTracking() {
  if (!currentBookingId || !window._firebase) return;
  window._firebase.db.collection("bookings").doc(currentBookingId)
    .onSnapshot(doc => { if (!doc.exists) return; updateTrackBanner(doc.data()); });
}

function updateTrackBanner(b) {
  const statusOrder  = ["confirmed","assigned","packing","transit","delivered"];
  const statusLabels = { confirmed:"Confirmed", assigned:"Driver Assigned", packing:"Packing Started", transit:"In Transit 🚚", delivered:"Delivered ✅" };
  const idx = statusOrder.indexOf(b.status || "confirmed");
  if (b.status === "delivered" || b.status === "cancelled") {
    localStorage.removeItem("packzen_active_booking");
    setTimeout(() => dismissTrackBanner(), 3000);
  }
  const labelEl = document.getElementById("tobStatusLabel");
  if (labelEl) labelEl.textContent = statusLabels[b.status] || b.status || "Confirmed";
  const fill = document.getElementById("tobProgressFill");
  if (fill) fill.style.width = ((idx / (statusOrder.length - 1)) * 100) + "%";
  statusOrder.forEach((s, i) => {
    const step = document.getElementById("tobs" + i);
    if (!step) return;
    step.className = "tob-step";
    if (i < idx)   step.classList.add("done");
    if (i === idx) step.classList.add("active");
  });
  const driverRow = document.getElementById("tobDriverRow");
  if (b.driverName && driverRow) {
    document.getElementById("tobDriverName").textContent = "Driver: " + b.driverName;
    const phoneEl = document.getElementById("tobDriverPhone");
    if (b.driverPhone) { phoneEl.href = "tel:" + b.driverPhone; phoneEl.textContent = "📞 Call Driver"; }
    driverRow.style.display = "flex";
  }
  const banner = document.getElementById("trackOrderBanner");
  if (b.status === "delivered" && banner) {
    banner.style.background = "linear-gradient(135deg,#15803d,#16a34a)";
    const title = banner.querySelector(".tob-title");
    if (title) title.textContent = "🎉 Your Move is Complete!";
  }
}

async function checkAndShowActiveBooking(uid) {
  if (!window._firebase) return;
  try {
    const savedId = localStorage.getItem("packzen_active_booking");
    if (savedId) {
      const doc = await window._firebase.db.collection("bookings").doc(savedId).get();
      if (doc.exists) {
        const b = doc.data();
        if (["confirmed","assigned","packing","transit"].includes(b.status) && b.customerUid === uid) {
          currentBookingId = savedId;
          const tobId = document.getElementById("tobBookingId");
          if (tobId) tobId.textContent = b.bookingRef || savedId.slice(0,8).toUpperCase();
          document.getElementById("trackOrderBanner").style.display = "block";
          updateTrackBanner(b); startBannerTracking(); return;
        } else localStorage.removeItem("packzen_active_booking");
      }
    }
    const snap = await window._firebase.db.collection("bookings")
      .where("customerUid","==",uid).where("status","in",["confirmed","assigned","packing","transit"]).limit(1).get();
    if (snap.empty) return;
    const doc = snap.docs[0]; const b = doc.data();
    currentBookingId = doc.id;
    localStorage.setItem("packzen_active_booking", doc.id);
    const tobId = document.getElementById("tobBookingId");
    if (tobId) tobId.textContent = b.bookingRef || doc.id.slice(0,8).toUpperCase();
    document.getElementById("trackOrderBanner").style.display = "block";
    updateTrackBanner(b); startBannerTracking();
  } catch(e) {}
}

function dismissTrackBanner() {
  const banner = document.getElementById("trackOrderBanner");
  if (banner) banner.style.display = "none";
}

function openTrackingOrLogin() {
  if (!currentUser) { showToast("💡 Create an account to track your booking!"); openAuthModal("login"); return; }
  openTrackingModal();
}

/* ============================================
   TRACKING MODAL
   ============================================ */
function openTrackingModal() {
  document.getElementById("userDropdown")?.classList.remove("open");
  if (!currentUser) { openAuthModal("login"); return; }
  document.getElementById("trackingModal").style.display = "flex";
  loadTrackingData();
}

function closeTrackingModal() {
  document.getElementById("trackingModal").style.display = "none";
  if (trackingListener) { trackingListener(); trackingListener = null; }
}

function loadTrackingData() {
  if (!currentUser || !window._firebase) return;
  if (trackingListener) { trackingListener(); trackingListener = null; }
  trackingListener = window._firebase.db.collection("bookings")
    .where("customerUid","==",currentUser.uid).orderBy("createdAt","desc").limit(1)
    .onSnapshot(snap => {
      if (snap.empty) { document.getElementById("trackingBookingId").textContent = "No active booking"; return; }
      const booking = { id: snap.docs[0].id, ...snap.docs[0].data() };
      currentBookingId = booking.id;
      updateTrackingUI(booking);
    });
}

function updateTrackingUI(b) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("trackingBookingId", "#" + b.id.slice(-6).toUpperCase());
  set("trackStatus",       capitalize(b.status||"confirmed"));
  set("trackDriver",       b.driverName  || "Not yet assigned");
  set("trackDriverPhone",  b.driverPhone || "—");
  set("trackDate",         b.date        || "—");
  set("trackPickup",       b.pickup      || "—");
  set("trackDrop",         b.drop        || "—");
  const order = ["confirmed","assigned","packing","transit","delivered"];
  const icons  = ["✓","🚛","📦","🚚","🎉"];
  const idx    = order.indexOf(b.status||"confirmed");
  order.forEach((s, i) => {
    const dot = document.getElementById("ts" + i);
    if (!dot) return;
    dot.className = "ts-dot";
    if (i < idx)   { dot.classList.add("done"); dot.textContent = "✓"; }
    if (i === idx) { dot.classList.add("active"); dot.textContent = icons[i]; }
    if (i > idx)   dot.textContent = icons[i];
  });
  if (b.driverLat && b.driverLng) updateTrackingMap(b.driverLat, b.driverLng);
}

function updateTrackingMap(lat, lng) {
  const mapDiv = document.getElementById("trackingMapDiv");
  if (typeof google !== "undefined" && google.maps) {
    mapDiv.innerHTML = ""; mapDiv.style.height = "200px";
    if (!trackingMap) trackingMap = new google.maps.Map(mapDiv, { center: { lat, lng }, zoom: 14 });
    const pos = { lat, lng };
    trackingMap.setCenter(pos);
    if (trackingDriverMarker) trackingDriverMarker.setPosition(pos);
    else trackingDriverMarker = new google.maps.Marker({ map: trackingMap, position: pos, title: "Your Driver" });
  } else { mapDiv.innerHTML = `<span>📍 Driver at ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`; }
}

/* ============================================
   CHAT MODAL
   ============================================ */
function openChatModal() {
  document.getElementById("userDropdown")?.classList.remove("open");
  if (!currentUser) { openAuthModal("login"); return; }
  document.getElementById("chatModal").style.display = "flex";
  if (currentBookingId && window._firebase) {
    window._firebase.db.collection("bookings").doc(currentBookingId).get().then(doc => {
      if (!doc.exists) return;
      const b  = doc.data();
      const el = id => document.getElementById(id);
      if (b.driverName) {
        if (el("chatDrvName"))   el("chatDrvName").textContent   = b.driverName;
        if (el("chatDrvStatus")) el("chatDrvStatus").textContent = b.driverPhone || "Your Driver";
        if (el("chatDrvAvatar")) el("chatDrvAvatar").textContent = b.driverName.charAt(0).toUpperCase();
      }
    });
  }
  loadChatMessages();
}

function closeChatModal() {
  document.getElementById("chatModal").style.display = "none";
  if (chatListener) { chatListener(); chatListener = null; }
}

function loadChatMessages() {
  if (!window._firebase || !currentBookingId) {
    window._firebase?.db.collection("bookings").where("customerUid","==",currentUser.uid).orderBy("createdAt","desc").limit(1)
      .get().then(snap => {
        if (!snap.empty) { currentBookingId = snap.docs[0].id; listenChatMessages(); }
        else renderChatEmpty();
      });
    return;
  }
  listenChatMessages();
}

function listenChatMessages() {
  if (!currentBookingId) { renderChatEmpty(); return; }
  if (chatListener) { chatListener(); chatListener = null; }
  chatListener = window._firebase.db.collection("chats").doc(currentBookingId)
    .collection("messages").orderBy("time","asc")
    .onSnapshot(snap => {
      const container = document.getElementById("chatMessages");
      if (snap.empty) { container.innerHTML = '<div class="chat-empty-msg">No messages yet. Say hello! 👋</div>'; return; }
      container.innerHTML = "";
      snap.forEach(d => {
        const msg    = d.data();
        const isMine = msg.senderUid === currentUser?.uid;
        const time   = msg.time?.toDate ? msg.time.toDate().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "";
        const senderLabel = (!isMine && msg.senderName) ? `<span class="chat-sender">${msg.senderName}</span>` : "";
        container.innerHTML += `<div class="chat-bubble ${isMine?"mine":"theirs"}">${senderLabel}<div>${msg.text}</div><div class="chat-time">${time}</div></div>`;
      });
      container.scrollTop = container.scrollHeight;
    });
}

function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const text  = input.value.trim();
  if (!text || !currentBookingId) return;
  input.value = "";
  window._firebase?.db.collection("chats").doc(currentBookingId).collection("messages").add({
    text, senderUid: currentUser?.uid, senderName: currentUser?.displayName || "Customer",
    role: "customer", time: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e => showToast("Send failed: " + e.message));
}

function renderChatEmpty() {
  document.getElementById("chatMessages").innerHTML = '<div class="chat-empty-msg">No active booking found.<br>Book a move to chat with your driver.</div>';
}

/* ============================================
   MOVING CHECKLIST
   ============================================ */
const CHECKLIST_DATA = {
  "2 Weeks Before": ["Notify your landlord / society","Contact PackZen for booking confirmation","Start collecting packing boxes","Sort items — keep, donate, discard","Update your address with bank & insurance"],
  "1 Week Before":  ["Start packing non-essential items","Label all boxes by room","Pack fragile items with extra padding","Defrost refrigerator","Arrange for parking at both locations"],
  "Moving Day":     ["Check all rooms before leaving","Ensure utilities are transferred","Take photos of all packed items","Keep essentials bag with you","Verify all boxes are loaded","Do a final walkthrough of old home"],
  "After Moving":   ["Unpack essentials first","Check all items for damage","Update Aadhaar address","Connect utilities at new home","Leave a review for PackZen ⭐"]
};

function buildChecklist() {
  const container = document.getElementById("checklistContent");
  if (!container) return;
  const saved = JSON.parse(localStorage.getItem("packzen-checklist") || "{}");
  let html = "";
  Object.entries(CHECKLIST_DATA).forEach(([cat, items]) => {
    html += `<div class="cl-category">${cat}</div>`;
    items.forEach((item, i) => {
      const key = cat + i, done = saved[key];
      html += `<div class="cl-item ${done?"done":""}" onclick="toggleChecklist('${key}',this)"><div class="cl-check">${done?"✓":""}</div><div class="cl-text">${item}</div></div>`;
    });
  });
  container.innerHTML = html;
  updateChecklistProgress();
}

function toggleChecklist(key, el) {
  const saved = JSON.parse(localStorage.getItem("packzen-checklist") || "{}");
  saved[key] = !saved[key];
  localStorage.setItem("packzen-checklist", JSON.stringify(saved));
  el.classList.toggle("done");
  el.querySelector(".cl-check").textContent = el.classList.contains("done") ? "✓" : "";
  updateChecklistProgress();
}

function updateChecklistProgress() {
  const saved = JSON.parse(localStorage.getItem("packzen-checklist") || "{}");
  const total = Object.values(CHECKLIST_DATA).reduce((s, a) => s + a.length, 0);
  const done  = Object.values(saved).filter(Boolean).length;
  const bar   = document.getElementById("clProgressBar");
  const score = document.getElementById("clScore");
  if (bar)   bar.style.width = (total ? Math.round(done / total * 100) : 0) + "%";
  if (score) score.textContent = `${done} / ${total}`;
}

function openChecklist()  { document.getElementById("userDropdown")?.classList.remove("open"); buildChecklist(); document.getElementById("checklistModal").style.display = "flex"; }
function closeChecklist() { document.getElementById("checklistModal").style.display = "none"; }

/* ============================================
   REVIEWS
   ============================================ */
function openReviewModal()  { document.getElementById("reviewModal").style.display = "flex"; currentRating = 0; }
function closeReviewModal() { document.getElementById("reviewModal").style.display = "none"; }

function setRating(n) {
  currentRating = n;
  document.querySelectorAll(".star-btn").forEach((btn, i) => btn.classList.toggle("lit", i < n));
}

async function submitReview() {
  const text = document.getElementById("reviewText").value.trim();
  const name = document.getElementById("reviewName").value.trim();
  if (!currentRating) return showError("reviewMsg", "Please select a rating.");
  if (!text)          return showError("reviewMsg", "Please write your review.");
  if (!name)          return showError("reviewMsg", "Please enter your name.");
  waitForFirebase(async () => {
    try {
      await window._firebase.db.collection("reviews").add({
        text, name, rating: currentRating,
        uid: currentUser?.uid||null, email: currentUser?.email||null,
        status: "approved", date: new Date().toLocaleDateString("en-IN"),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      closeReviewModal(); showToast("🌟 Thank you for your review!"); loadReviewsPublic();
    } catch(e) { showError("reviewMsg", "Error submitting: " + e.message); }
  });
}

async function loadReviewsPublic() {
  waitForFirebase(async () => {
    try {
      const snap    = await window._firebase.db.collection("reviews").where("status","==","approved").orderBy("createdAt","desc").limit(6).get();
      if (snap.empty) return;
      const grid    = document.getElementById("reviewsGrid");
      const countEl = document.getElementById("reviewCountLabel");
      if (countEl) countEl.textContent = `Based on ${snap.size}+ reviews`;
      let html = "";
      snap.forEach(d => {
        const r = d.data();
        html += `<div class="review-card"><div class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</div><p class="review-text">"${r.text}"</p><div class="review-author"><div class="review-avatar">${r.name.charAt(0).toUpperCase()}</div><div><div class="review-name">${r.name}</div><div class="review-meta">${r.date||""}</div></div></div></div>`;
      });
      if (grid) grid.innerHTML = html;
    } catch(e) {}
  });
}

/* ============================================
   MULTI-STEP FORM
   ============================================ */
let currentStep  = 0;
function getSteps() { return document.querySelectorAll(".form-step"); }
const STEP_LABELS = ["What type of move?","Where are you moving?","When & what type of move?","What are you moving?","Almost done — confirm & book"];
let selectedMoveType = "home";

const MOVE_TYPE_CONFIG = window.MOVE_TYPE_CONFIG = {
  home: { sizeLabel:"House Type", icon:"🏠", sizes:[
    {icon:"🏠",label:"1 RK", sub:"Studio",  value:"1750"},
    {icon:"🏡",label:"1 BHK",sub:"Small",   value:"3950"},
    {icon:"🏘️",label:"2 BHK",sub:"Medium",  value:"5750"},
    {icon:"🏰",label:"3 BHK",sub:"Large",   value:"7450"},
    {icon:"🏯",label:"4 BHK",sub:"X-Large", value:"8350"},
    {icon:"🌇",label:"Villa", sub:"Premium", value:"10800"}
  ]},
  office: { sizeLabel:"Office Size", icon:"🏢", sizes:[
    {icon:"💼",label:"Cabin", sub:"1–5 desks",  value:"5400"},
    {icon:"🏢",label:"Small", sub:"5–15 desks", value:"8800"},
    {icon:"🏬",label:"Medium",sub:"15–30 desks",value:"13700"},
    {icon:"🏭",label:"Large", sub:"30+ desks",  value:"21550"}
  ]},
  single: { sizeLabel:"Item Type", icon:"📦", sizes:[
    {icon:"🛋️",label:"Furniture", sub:"Sofa, bed…",  value:"0"},
    {icon:"🧊",label:"Appliance", sub:"Fridge, AC…", value:"0"},
    {icon:"🏍️",label:"Bike/Cycle",sub:"Two-wheeler",  value:"500"},
    {icon:"📦",label:"Boxes",     sub:"Cartons",      value:"0"}
  ]}
};

function updateStepDots(n) {
  document.querySelectorAll(".step-dot").forEach((dot, i) => {
    dot.classList.remove("active","done");
    if (i < n)   dot.classList.add("done");
    if (i === n) dot.classList.add("active");
  });
  document.querySelectorAll(".step-line").forEach((line, i) => line.classList.toggle("done", i < n));
  const counter = document.getElementById("stepCurrent");
  const label   = document.getElementById("stepLabel");
  if (counter) counter.textContent = n + 1;
  if (label)   label.textContent   = STEP_LABELS[n] || "";
}

function showStep(n) {
  getSteps().forEach(s => s.classList.remove("active"));
  getSteps()[n].classList.add("active");
  const pb = document.getElementById("progressBar");
  if (pb) pb.style.width = ((n + 1) / 5) * 100 + "%";
  updateStepDots(n);
  setTimeout(() => {
    const formCard = document.querySelector(".form-card");
    if (formCard) {
      const navH = document.querySelector("nav")?.offsetHeight || 65;
      window.scrollTo({ top: window.scrollY + formCard.getBoundingClientRect().top - navH - 12, behavior: "smooth" });
    }
  }, 50);
  if (n === 2) { const vc = document.getElementById("vehicle"); if (!vc?.value) document.querySelector(".vehicle-card")?.click(); }
  if (n === 3) renderFurnitureGrid(selectedMoveType || "home");
  if (n === getSteps().length - 1) { calculateQuote(true); autoFillCustomerDetails(); }
}

function autoFillCustomerDetails() {
  if (!currentUser || !window._firebase) return;
  window._firebase.db.collection("users").doc(currentUser.uid).get()
    .then(doc => {
      if (!doc.exists) return;
      const d     = doc.data();
      const nameEl  = document.getElementById("custName");
      const phoneEl = document.getElementById("custPhone");
      if (nameEl  && !nameEl.value.trim())  nameEl.value  = d.name  || currentUser.displayName || "";
      if (phoneEl && !phoneEl.value.trim()) phoneEl.value = d.phone || "";
    }).catch(() => {});
}

function nextStep() {
  if (currentStep === 0 && !document.getElementById("moveType")?.value) { showToast("👆 Please select your move type"); return; }
  if (currentStep === 1) {
    if (!document.getElementById("pickup")?.value.trim()) { showToast("📍 Please enter a pickup location"); return; }
    if (!document.getElementById("drop")?.value.trim())   { showToast("🏁 Please enter a drop location"); return; }
  }
  if (currentStep === 2) {
    if (!document.getElementById("shiftDate")?.value) { showToast("📅 Please select a moving date"); return; }
    if (!document.getElementById("shiftTime")?.value) { showToast("🕐 Please select a time slot"); return; }
    if (!document.getElementById("house")?.value)     { showToast("🏠 Please select your house type"); return; }
    if (!isIntercityMove && !document.getElementById("vehicle")?.value) { showToast("🚚 Please select a vehicle type"); return; }
  }
  if (currentStep < getSteps().length - 1) { currentStep++; showStep(currentStep); }
}

function prevStep() { if (currentStep > 0) { currentStep--; showStep(currentStep); } }

function shakeField(el) {
  if (!el) return;
  el.classList.add("error");
  setTimeout(() => el.classList.remove("error"), 600);
}

function selectMoveType(el, type) {
  selectedMoveType = type;
  document.getElementById("moveType").value = type;
  document.querySelectorAll(".move-type-card, .bs-move-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  renderSizeCards(type);
  const houseEl = document.getElementById("house");
  if (houseEl) houseEl.value = "";
}

function renderSizeCards(type) {
  const config = MOVE_TYPE_CONFIG[type] || MOVE_TYPE_CONFIG.home;
  const label  = document.getElementById("sizeLabelText");
  const cards  = document.getElementById("houseCards");
  const select = document.getElementById("house");
  if (label) label.textContent = config.sizeLabel;
  if (cards) cards.innerHTML = config.sizes.map(s => `
    <div class="select-card" onclick="selectCard(this,'house','${s.value}')">
      <div class="sc-icon">${s.icon}</div><div class="sc-label">${s.label}</div><div class="sc-sub">${s.sub}</div>
    </div>`).join("");
  if (select) {
    select.innerHTML = '<option value="">Select size</option>' +
      config.sizes.map(s => `<option value="${s.value}">${s.label}</option>`).join("");
  }
  renderFurnitureGrid(type);
}

const FURNITURE_CATEGORIES = {
  home: [
    {id:"cat-living",  icon:"🛋️", label:"Living Room", items:[{id:"sofaCheck",emoji:"🛋️",name:"Sofa"},{id:"tvCheck",emoji:"📺",name:"TV"},{id:"tvUnitCheck",emoji:"🗄️",name:"TV Unit"},{id:"coffeeCheck",emoji:"☕",name:"Coffee Table"},{id:"acCheck",emoji:"❄️",name:"AC Unit"}]},
    {id:"cat-bedroom", icon:"🛏️", label:"Bedroom",     items:[{id:"bedCheck",emoji:"🛏️",name:"Bed"},{id:"wardrobeCheck",emoji:"🚪",name:"Wardrobe"},{id:"dressingCheck",emoji:"🪞",name:"Dressing Table"},{id:"sideTableCheck",emoji:"🪑",name:"Side Table"}]},
    {id:"cat-kitchen", icon:"🍳", label:"Kitchen",      items:[{id:"fridgeCheck",emoji:"🧊",name:"Fridge"},{id:"wmCheck",emoji:"🫧",name:"Washing Machine"},{id:"microwaveCheck",emoji:"📦",name:"Microwave"},{id:"chimneyCheck",emoji:"🔧",name:"Chimney"},{id:"diningCheck",emoji:"🪑",name:"Dining Table+Chairs"}]},
    {id:"cat-other",   icon:"📦", label:"Other Items",  items:[{id:"bikeCheck",emoji:"🏍️",name:"Bike/Scooter"},{id:"cycleCheck",emoji:"🚲",name:"Cycle"},{id:"plantCheck",emoji:"🪴",name:"Large Plants"},{id:"gymCheck",emoji:"🏋️",name:"Gym Equipment"}]}
  ],
  office: [
    {id:"cat-workstation",icon:"🖥️",label:"Workstation",    items:[{id:"deskCheck",emoji:"🖥️",name:"Office Desk"},{id:"chairCheck",emoji:"🪑",name:"Chair"},{id:"serverCheck",emoji:"💾",name:"Server/PC"},{id:"printerCheck",emoji:"🖨️",name:"Printer"}]},
    {id:"cat-cabin",      icon:"🏢",label:"Cabin / Meeting",items:[{id:"confCheck",emoji:"📋",name:"Conference Table"},{id:"cabinetCheck",emoji:"🗄️",name:"Filing Cabinet"},{id:"whiteboardCheck",emoji:"📝",name:"Whiteboard"}]},
    {id:"cat-appliances", icon:"❄️",label:"Appliances",      items:[{id:"fridgeCheck",emoji:"🧊",name:"Fridge"},{id:"acCheck",emoji:"❄️",name:"AC Unit"},{id:"wmCheck",emoji:"🫧",name:"Washing Machine"}]},
    {id:"cat-other",      icon:"📦",label:"Other Items",     items:[{id:"plantCheck",emoji:"🪴",name:"Large Plants"},{id:"gymCheck",emoji:"🏋️",name:"Gym Equipment"}]}
  ]
};

function renderFurnitureGrid(type) {
  const grid = document.querySelector(".furniture-grid");
  if (!grid) return;
  const categories = FURNITURE_CATEGORIES[type] || FURNITURE_CATEGORIES.home;
  const FREE_CATS  = ["cat-kitchen","cat-other","cat-appliances"];
  const itemCard = (item, catId) => `
    <label class="furniture-card">
      <input type="checkbox" id="${item.id}" onchange="calculateQuote(true)" aria-label="${item.name}">
      <div class="fc-body">
        <div class="fc-check">✓</div>
        <span class="fc-emoji">${item.emoji}</span>
        <span class="fc-name">${item.name}</span>
        <span class="fc-price" style="${FREE_CATS.includes(catId)?"color:#94a3b8":""}">
          ${FREE_CATS.includes(catId)?"FREE":"+₹150"}
        </span>
      </div>
    </label>`;
  const categoryBlock = cat => `
    <div class="fc-category">
      <div class="fc-category-header" onclick="toggleFurnitureCategory('${cat.id}')">
        <span class="fc-cat-icon">${cat.icon}</span>
        <span class="fc-cat-label">${cat.label}</span>
        <span class="fc-cat-arrow" id="arrow-${cat.id}">▾</span>
      </div>
      <div class="fc-category-items" id="${cat.id}" style="display:flex">
        ${cat.items.map(item => itemCard(item, cat.id)).join("")}
      </div>
    </div>`;
  const cartonSection = `
    <div class="fc-category">
      <div class="fc-category-header" onclick="toggleFurnitureCategory('cat-carton')">
        <span class="fc-cat-icon">📦</span><span class="fc-cat-label">Carton Boxes</span>
        <span class="fc-cat-arrow" id="arrow-cat-carton">▾</span>
      </div>
      <div class="fc-category-items" id="cat-carton" style="display:flex">
        <div class="carton-box-row">
          <span class="carton-label">📦 How many carton boxes?</span>
          <div class="carton-qty-wrap">
            <button class="qty-btn" onclick="changeCartonQty(-1)">−</button>
            <input type="number" id="cartonQty" value="0" min="0" max="50" class="fc-qty" onchange="calculateQuote(true)">
            <button class="qty-btn" onclick="changeCartonQty(1)">+</button>
          </div>
          <span class="carton-price-note">₹50 per box</span>
        </div>
      </div>
    </div>`;
  grid.innerHTML = categories.map(categoryBlock).join("") + cartonSection;
}

function toggleFurnitureCategory(id) {
  const panel = document.getElementById(id);
  const arrow = document.getElementById("arrow-" + id);
  if (!panel) return;
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "flex";
  if (arrow) arrow.textContent = isOpen ? "▸" : "▾";
}

function changeCartonQty(delta) {
  const input = document.getElementById("cartonQty");
  if (!input) return;
  input.value = Math.max(0, Math.min(50, (parseInt(input.value) || 0) + delta));
  calculateQuote(true);
}

function selectCard(el, type, value) {
  const select = document.getElementById(type);
  if (select) select.value = value;
  const parent = el.closest(type === "house" ? ".select-cards" : ".vehicle-cards");
  if (parent) parent.querySelectorAll(type === "house" ? ".select-card" : ".vehicle-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  if (currentStep === getSteps().length - 1) calculateQuote(true);
}

function changeQty(id, delta) {
  const input = document.getElementById(id);
  if (!input) return;
  input.value = Math.max(1, Math.min(9, (parseInt(input.value) || 1) + delta));
  calculateQuote(true);
}

/* ============================================
   HELPERS
   ============================================ */
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

function getFurnitureSummary() {
  const checks = [
    ["sofaCheck","Sofa"],["bedCheck","Bed"],["tvCheck","TV"],["tvUnitCheck","TV Unit"],
    ["coffeeCheck","Coffee Table"],["acCheck","AC Unit"],["wardrobeCheck","Wardrobe"],
    ["dressingCheck","Dressing Table"],["sideTableCheck","Side Table"],["fridgeCheck","Fridge"],
    ["wmCheck","Washing Machine"],["microwaveCheck","Microwave"],["chimneyCheck","Chimney"],
    ["diningCheck","Dining Table"],["bikeCheck","Bike/Scooter"],["cycleCheck","Cycle"],
    ["plantCheck","Large Plants"],["gymCheck","Gym Equipment"],["deskCheck","Office Desk"],
    ["chairCheck","Chair"],["cabinetCheck","Filing Cabinet"],["serverCheck","Server/PC"],
    ["printerCheck","Printer"],["confCheck","Conf. Table"],["whiteboardCheck","Whiteboard"]
  ];
  const items     = checks.filter(([id]) => document.getElementById(id)?.checked).map(([,name]) => name);
  const cartonQty = parseInt(document.getElementById("cartonQty")?.value || 0);
  if (cartonQty > 0) items.push(`Carton Boxes x${cartonQty}`);
  return items.join(", ") || "";
}

/* ============================================
   CREATE DRIVER (Admin)
   ============================================ */
async function createDriver() {
  if (!currentUser) { showToast("⚠️ Please login as admin."); return; }
  const name     = document.getElementById("newDriverName").value.trim();
  const email    = document.getElementById("newDriverEmail").value.trim();
  const password = document.getElementById("newDriverPassword").value.trim();
  const msg      = document.getElementById("adminMsg");
  const setMsg   = (text, ok) => { msg.style.color = ok ? "#16a34a" : "#dc2626"; msg.textContent = text; };
  if (!name) return setMsg("⚠️ Please enter driver name.", false);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg("⚠️ Invalid email.", false);
  if (password.length < 6) return setMsg("⚠️ Password must be at least 6 characters.", false);
  const adminSnap = await window._firebase.db.collection("users").doc(currentUser.uid).get();
  if (!adminSnap.exists || adminSnap.data().role !== "admin") return setMsg("⚠️ Access denied.", false);
  setMsg("⏳ Creating driver account...", true);
  try {
    const secondaryApp  = firebase.initializeApp(firebase.app().options, "driverCreation_" + Date.now());
    const secondaryAuth = secondaryApp.auth();
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    await secondaryAuth.signOut(); await secondaryApp.delete();
    await window._firebase.db.collection("users").doc(cred.user.uid).set({
      name, email, role: "driver", isOnline: false, phone: "", vehicle: "", rating: 0, totalMoves: 0,
      createdBy: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    setMsg(`✅ Driver "${name}" created!`, true);
    ["newDriverName","newDriverEmail","newDriverPassword"].forEach(id => { document.getElementById(id).value = ""; });
  } catch(error) {
    setMsg("⚠️ " + (error.code === "auth/email-already-in-use" ? "Email already exists." : error.message), false);
  }
}

/* ============================================
   BOOK WITHOUT PAYMENT
   ============================================ */
function bookWithoutPayment() {
  if (!currentUser) { showToast("👋 Please login to book."); openAuthModal("login"); return; }
  if (!document.getElementById("tncAccepted")?.checked) { showToast("⚠️ Please accept the Terms & Conditions to continue."); return; }
  const nameEl  = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  const name    = nameEl?.value?.trim();
  const phone   = phoneEl?.value?.trim();
  if (!name)  { nameEl.style.borderColor = "#e53e3e"; nameEl.focus(); return; }
  if (!phone || phone.length < 10) { phoneEl.style.borderColor = "#e53e3e"; phoneEl.focus(); return; }
  if (lastCalculatedTotal === 0) { showToast("⚠️ Price not calculated yet."); return; }
  if (!window._firebase)         { showToast("⚠️ Service not ready. Try again."); return; }
  const pickup    = document.getElementById("pickup")?.value  || "";
  const drop      = document.getElementById("drop")?.value    || "";
  const date      = document.getElementById("shiftDate")?.value || "";
  const bookingRef = "PKZ-" + Date.now().toString(36).toUpperCase().slice(-6);
  const btn = document.querySelector(".btn-pay");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Saving..."; }
  const houseEl   = document.getElementById("house");
  const vehicleEl = document.getElementById("vehicle");
  const discountedTotal = Math.max(lastCalculatedTotal - promoDiscount, 0);
  window._firebase.db.collection("bookings").add({
    bookingRef, customerUid: currentUser.uid, customerName: name, phone, pickup, drop, date,
    moveType: selectedMoveType,
    house:   houseEl?.options[houseEl?.selectedIndex]?.text    || "",
    vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text || "",
    furniture: getFurnitureSummary(),
    pickupFloor: document.getElementById("pickupFloor")?.options[document.getElementById("pickupFloor")?.selectedIndex]?.text||"",
    dropFloor:   document.getElementById("dropFloor")?.options[document.getElementById("dropFloor")?.selectedIndex]?.text||"",
    liftAvailable: !!document.getElementById("liftAvailable")?.checked,
    packingService: false, total: discountedTotal, originalTotal: lastCalculatedTotal,
    paid: 0, paymentType: "pay_later", status: "confirmed", source: "direct",
    promoDiscount, photos: uploadedPhotos.slice(0, 3),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(docRef => {
    currentBookingId = docRef.id;
    localStorage.setItem("packzen_active_booking", docRef.id);
    if (btn) { btn.disabled = false; btn.textContent = "📋 Confirm Booking · Pay on Delivery"; }
    queueSMS(phone, "booking_confirmed", { name, bookingRef, date, pickup, total: discountedTotal });
    notifyOwner(bookingRef, name, phone, pickup, drop, date, discountedTotal, "pay_later", "direct");
    showConfirmationCard({
      bookingRef, name, phone: "+91 " + phone, pickup, drop, date,
      house:   houseEl?.options[houseEl?.selectedIndex]?.text    || "—",
      vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text || "—",
      total: discountedTotal, paymentLabel: "Cash on moving day",
      paymentNote: "Pay full amount to driver on moving day", source: "direct", showInvoice: false
    });
    pendingWhatsAppMsg = `✅ *Booking Confirmed — PackZen* 🚚\n\n📌 *Booking ID:* ${bookingRef}\n👤 *Name:* ${name}\n📍 *Pickup:* ${pickup}\n🏁 *Drop:* ${drop}\n📅 *Date:* ${date||"TBD"}\n💰 *Estimate:* ₹${discountedTotal.toLocaleString("en-IN")}\n💳 *Payment:* Pay on moving day\n\nOur team will call you shortly.\n— PackZen | 📞 9945095453`;
    showToast("✅ Booking saved! ID: " + bookingRef);
  }).catch(e => {
    if (btn) { btn.disabled = false; btn.textContent = "📋 Confirm Booking · Pay on Delivery"; }
    showToast("❌ Booking failed: " + e.message);
  });
}

function copyBookingId() {
  const id = document.getElementById("bookingIdDisplay")?.textContent;
  if (!id || id === "—") return;
  navigator.clipboard.writeText(id).then(() => showToast("✅ Booking ID copied!"))
    .catch(() => {
      const el = document.createElement("textarea"); el.value = id;
      document.body.appendChild(el); el.select(); document.execCommand("copy");
      document.body.removeChild(el); showToast("✅ Booking ID copied!");
    });
}

/* ============================================
   DASHBOARD TABS
   ============================================ */
function closeDashboard() { document.getElementById("dashboardModal").style.display = "none"; }

function switchDashTab(tab, el) {
  ["dashQuotes","dashBookings","dashReferral","dashProfile","dashAdmin"].forEach(id => {
    const panel = document.getElementById(id);
    if (panel) panel.style.display = "none";
  });
  document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
  const target = document.getElementById("dash" + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (target) target.style.display = "block";
  if (el) el.classList.add("active");
  if (tab === "referral") loadReferralData();
  if (tab === "bookings") loadUserBookings();
  if (tab === "profile")  loadProfileData();
}

function loadUserQuotes() {
  if (!currentUser || !window._firebase) return;
  window._firebase.db.collection("quotes").where("uid","==",currentUser.uid).orderBy("createdAt","desc").limit(10).get()
    .then(snap => {
      const list = document.getElementById("quotesList");
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<div class="dash-empty">No saved quotes yet.</div>'; return; }
      list.innerHTML = snap.docs.map(d => {
        const q = d.data();
        return `<div class="quote-item"><div class="qi-route">📍 ${q.pickup||"?"} → 🏁 ${q.drop||"?"}</div><div class="qi-details"><span>${q.house||"—"}</span><span>${q.vehicle||"—"}</span><span class="qi-price">₹${(q.total||0).toLocaleString("en-IN")}</span></div><div class="qi-date">${q.date||""}</div></div>`;
      }).join("");
    }).catch(() => {});
}

function loadUserBookings() {
  if (!currentUser || !window._firebase) return;
  const list = document.getElementById("bookingsList");
  if (list) list.innerHTML = '<div class="dash-empty" style="text-align:center;padding:20px">Loading...</div>';
  window._firebase.db.collection("bookings").where("customerUid","==",currentUser.uid).orderBy("createdAt","desc").limit(10).get()
    .then(snap => {
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<div class="dash-empty">No bookings yet.</div>'; return; }
      const statusColors = {confirmed:"#0057ff",assigned:"#7c3aed",packing:"#0ea5e9",transit:"#f97316",delivered:"#16a34a",cancelled:"#dc2626"};
      const statusIcons  = {confirmed:"📋",assigned:"🚛",packing:"📦",transit:"🚚",delivered:"✅",cancelled:"❌"};
      list.innerHTML = snap.docs.map(d => {
        const b = d.data(), id = d.id;
        const color = statusColors[b.status] || "#5a6a8a";
        const icon  = statusIcons[b.status]  || "📋";
        const canCancel     = !["packing","transit","delivered","cancelled"].includes(b.status);
        const canReschedule = !["transit","delivered","cancelled"].includes(b.status);
        const canRate       = b.status === "delivered" && !b.driverRating;
        const canClaim      = b.status === "delivered" && !b.damageClaimed;
        return `<div class="bk-card">
          <div class="bk-card-top"><div class="bk-route">${(b.pickup||"?").split(",")[0]} → ${(b.drop||"?").split(",")[0]}</div><div class="bk-status" style="color:${color}">${icon} ${capitalize(b.status||"confirmed")}</div></div>
          <div class="bk-meta"><span>₹${(b.total||0).toLocaleString("en-IN")}</span><span>${b.date||"Date TBD"}</span><span style="font-size:.72rem;color:#5a6a8a">${b.bookingRef||""}</span></div>
          ${canCancel||canReschedule||canRate||canClaim?`<div class="bk-actions">
            ${canReschedule?`<button class="bk-btn reschedule" onclick="openRescheduleModal('${id}','${b.bookingRef||id}','${b.date||""}')">📅 Reschedule</button>`:""}
            ${canCancel?`<button class="bk-btn cancel" onclick="openCancelModal('${id}','${b.bookingRef||id}','${b.status||""}')">✕ Cancel</button>`:""}
            ${canRate?`<button class="bk-btn rate" onclick="openRateDriverModal('${id}','${b.bookingRef||id}','${b.driverName||""}')">⭐ Rate Driver</button>`:""}
            ${canClaim?`<button class="bk-btn claim" onclick="openDamageModal('${id}','${b.bookingRef||id}')">🔧 Report Damage</button>`:""}
          </div>`:""}
        </div>`;
      }).join("");
    }).catch(() => {});
}

function loadProfileData() {
  if (!currentUser || !window._firebase) return;
  window._firebase.db.collection("users").doc(currentUser.uid).get().then(doc => {
    if (!doc.exists) return;
    const d = doc.data();
    if (document.getElementById("profileName"))  document.getElementById("profileName").value  = d.name  || "";
    if (document.getElementById("profileEmail")) document.getElementById("profileEmail").value = d.email || currentUser.email || "";
    if (document.getElementById("profilePhone")) document.getElementById("profilePhone").value = d.phone || "";
    if (document.getElementById("prefEmail"))    document.getElementById("prefEmail").checked  = d.prefEmail !== false;
    if (document.getElementById("prefSMS"))      document.getElementById("prefSMS").checked    = d.prefSMS   !== false;
  }).catch(() => {});
}

function saveProfile() {
  if (!currentUser || !window._firebase) return;
  const name  = document.getElementById("profileName")?.value.trim();
  const msgEl = document.getElementById("profileMsg");
  if (!name) { if (msgEl) { msgEl.textContent = "Name cannot be empty."; msgEl.style.color = "#dc2626"; } return; }
  window._firebase.db.collection("users").doc(currentUser.uid).update({ name })
    .then(() => {
      currentUser.updateProfile({ displayName: name });
      if (msgEl) { msgEl.textContent = "✅ Profile saved!"; msgEl.style.color = "#16a34a"; }
      updateNavForUser(currentUser);
    }).catch(e => { if (msgEl) { msgEl.textContent = "Error: " + e.message; msgEl.style.color = "#dc2626"; } });
}

function savePreferences() {
  if (!currentUser || !window._firebase) return;
  window._firebase.db.collection("users").doc(currentUser.uid).update({
    prefEmail: !!document.getElementById("prefEmail")?.checked,
    prefSMS:   !!document.getElementById("prefSMS")?.checked
  }).catch(() => {});
}

function openProfile() {
  document.getElementById("userDropdown")?.classList.remove("open");
  if (!currentUser) { openAuthModal("login"); return; }
  openDashboard();
  setTimeout(() => switchDashTab("profile", document.querySelector(".dash-tab:nth-child(4)")), 300);
}

/* ============================================
   CANCEL / RESCHEDULE / RATE / DAMAGE
   ============================================ */
function openCancelModal(bookingDocId, bookingRef, status) {
  if (["packing","transit","delivered"].includes(status)) { showToast("❌ Cannot cancel after packing has started."); return; }
  document.getElementById("cancelBookingDocId").value = bookingDocId;
  document.getElementById("cancelBookingRef").textContent = bookingRef || bookingDocId;
  document.getElementById("cancelReason").value = "";
  document.getElementById("cancelModal").style.display = "flex";
}
function closeCancelModal() { document.getElementById("cancelModal").style.display = "none"; }

async function confirmCancellation() {
  const docId  = document.getElementById("cancelBookingDocId").value;
  const reason = document.getElementById("cancelReason").value.trim();
  if (!reason) { showToast("⚠️ Please select a cancellation reason."); return; }
  if (!currentUser || !window._firebase) return;
  const btn = document.getElementById("btnConfirmCancel");
  if (btn) { btn.textContent = "Cancelling..."; btn.disabled = true; }
  try {
    await window._firebase.db.collection("bookings").doc(docId).update({ status:"cancelled", cancelReason:reason, cancelledAt:firebase.firestore.FieldValue.serverTimestamp(), cancelledBy:"customer" });
    await window._firebase.db.collection("cancelRequests").add({ bookingDocId:docId, reason, customerUid:currentUser.uid, createdAt:firebase.firestore.FieldValue.serverTimestamp(), resolved:false }).catch(() => {});
    const cancelledDoc = await window._firebase.db.collection("bookings").doc(docId).get();
    if (cancelledDoc.exists) {
      const cb = cancelledDoc.data();
      queueSMS(cb.phone || "", "cancelled", { name: cb.customerName || "", bookingRef: cb.bookingRef || docId });
    }
    closeCancelModal(); showToast("✅ Booking cancelled. Refund (if any) in 5–7 business days."); loadUserBookings();
    if (currentBookingId === docId) { dismissTrackBanner(); localStorage.removeItem("packzen_active_booking"); }
  } catch(e) { showToast("❌ Error: " + e.message); }
  finally { if (btn) { btn.textContent = "Yes, Cancel Booking"; btn.disabled = false; } }
}

function openRescheduleModal(bookingDocId, bookingRef, currentDate) {
  document.getElementById("rescheduleDocId").value = bookingDocId;
  document.getElementById("rescheduleBookingRef").textContent = bookingRef || bookingDocId;
  const dateInput = document.getElementById("rescheduleDate");
  if (dateInput) {
    dateInput.value = currentDate || "";
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    dateInput.min = tomorrow.toISOString().split("T")[0];
  }
  const timeInput = document.getElementById("rescheduleTime");
  if (timeInput) timeInput.value = "";
  document.getElementById("rescheduleModal").style.display = "flex";
}
function closeRescheduleModal() { document.getElementById("rescheduleModal").style.display = "none"; }

async function confirmReschedule() {
  const docId   = document.getElementById("rescheduleDocId").value;
  const newDate = document.getElementById("rescheduleDate").value;
  const newTime = document.getElementById("rescheduleTime").value;
  if (!newDate) { showToast("⚠️ Please select a new moving date."); return; }
  const selected = new Date(newDate); const today = new Date(); today.setHours(0,0,0,0);
  if (selected <= today) { showToast("⚠️ Please select a future date."); return; }
  if (!currentUser || !window._firebase) return;
  const btn = document.getElementById("btnConfirmReschedule");
  if (btn) { btn.textContent = "Saving..."; btn.disabled = true; }
  try {
    await window._firebase.db.collection("bookings").doc(docId).update({ date:newDate, time:newTime||"", rescheduledAt:firebase.firestore.FieldValue.serverTimestamp(), rescheduledBy:"customer", status:"confirmed" });
    const bookingDoc = await window._firebase.db.collection("bookings").doc(docId).get();
    if (bookingDoc.exists) {
      const b = bookingDoc.data();
      queueSMS(b.phone || "", "reschedule_confirmed", { name: b.customerName || "", bookingRef: b.bookingRef || docId, date: newDate });
    }
    closeRescheduleModal(); showToast("✅ Booking rescheduled!"); loadUserBookings();
  } catch(e) { showToast("❌ Error: " + e.message); }
  finally { if (btn) { btn.textContent = "Confirm Reschedule"; btn.disabled = false; } }
}

let ratingBookingDocId = "", selectedDriverRating = 0;
function openRateDriverModal(bookingDocId, bookingRef, driverName) {
  ratingBookingDocId = bookingDocId; selectedDriverRating = 0;
  document.getElementById("rateBookingRef").textContent = bookingRef || bookingDocId;
  document.getElementById("rateDriverName").textContent = driverName || "your driver";
  document.getElementById("ratingFeedback").value = "";
  document.getElementById("ratingMsg").textContent = "";
  document.querySelectorAll(".rate-star").forEach(s => s.classList.remove("active"));
  document.getElementById("rateDriverModal").style.display = "flex";
}
function closeRateDriverModal() { document.getElementById("rateDriverModal").style.display = "none"; }
function selectDriverRating(n) { selectedDriverRating = n; document.querySelectorAll(".rate-star").forEach((s,i) => s.classList.toggle("active",i<n)); }

async function submitDriverRating() {
  if (!selectedDriverRating) { showToast("⚠️ Please select a star rating."); return; }
  if (!currentUser || !window._firebase) return;
  const feedback = document.getElementById("ratingFeedback").value.trim();
  const btn = document.getElementById("btnSubmitRating");
  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }
  try {
    await window._firebase.db.collection("bookings").doc(ratingBookingDocId).update({ driverRating:selectedDriverRating, driverFeedback:feedback, ratedAt:firebase.firestore.FieldValue.serverTimestamp() });
    const bookingDoc = await window._firebase.db.collection("bookings").doc(ratingBookingDocId).get();
    const driverUid  = bookingDoc.data()?.driverUid;
    if (driverUid) {
      await window._firebase.db.collection("driverRatings").add({ driverUid, bookingDocId:ratingBookingDocId, rating:selectedDriverRating, feedback, customerUid:currentUser.uid, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
      const ratingsSnap = await window._firebase.db.collection("driverRatings").where("driverUid","==",driverUid).get();
      const ratings     = ratingsSnap.docs.map(d => d.data().rating);
      const avg         = ratings.reduce((a,b) => a+b,0) / ratings.length;
      await window._firebase.db.collection("drivers").doc(driverUid).update({ avgRating:Math.round(avg*10)/10, totalRatings:ratings.length }).catch(()=>{});
    }
    closeRateDriverModal(); showToast("⭐ Thanks for rating your driver!"); loadUserBookings();
  } catch(e) { showToast("Error: " + e.message); }
  finally { if (btn) { btn.textContent = "Submit Rating"; btn.disabled = false; } }
}

async function requestPushPermission() {
  if (!("Notification" in window) || !window._firebase?.messaging) return;
  try {
    if (await Notification.requestPermission() !== "granted") return;
    const token = await window._firebase.messaging.getToken({ vapidKey: window.ENV?.FCM_VAPID_KEY || "" });
    if (token && currentUser) await window._firebase.db.collection("users").doc(currentUser.uid).update({ fcmToken:token, fcmUpdatedAt:firebase.firestore.FieldValue.serverTimestamp() });
  } catch(e) {}
}

function subscribeToBookingNotifications(bookingDocId) {
  if (!bookingDocId || !window._firebase) return;
  const msgs = {
    assigned:  {title:"🚛 Driver Assigned!", body:"Your driver is on the way."},
    packing:   {title:"📦 Packing Started",  body:"Our team is packing your items."},
    transit:   {title:"🚚 On The Move!",     body:"Your goods are in transit."},
    delivered: {title:"🎉 Delivered!",       body:"Your move is complete."},
    cancelled: {title:"❌ Booking Cancelled",body:"Your booking has been cancelled."}
  };
  let lastStatus = "";
  window._firebase.db.collection("bookings").doc(bookingDocId).onSnapshot(doc => {
    if (!doc.exists) return;
    const status = doc.data().status;
    if (status && status !== lastStatus && msgs[status]) {
      if (Notification.permission === "granted") new Notification(msgs[status].title, { body:msgs[status].body, icon:"/favicon.ico" });
      lastStatus = status;
    }
  });
  setupStatusSMS(bookingDocId, "", "", "");
}

const SMS_TEMPLATES = {
  booking_confirmed:    d => `Hi ${d.name}, your PackZen booking ${d.bookingRef} is confirmed for ${d.date}! Pickup: ${(d.pickup||"").split(",")[0]}. Est: Rs.${Number(d.total).toLocaleString("en-IN")}. Track: packzenblr.in`,
  driver_assigned:      d => `Hi ${d.name}, your PackZen driver ${d.driverName} (${d.driverPhone}) is assigned for booking ${d.bookingRef}.`,
  move_started:         d => `Hi ${d.name}, your goods are now in transit for booking ${d.bookingRef}. Track: packzenblr.in`,
  delivered:            d => `Hi ${d.name}, your PackZen move ${d.bookingRef} is complete! Rate your driver on packzenblr.in.`,
  cancelled:            d => `Hi ${d.name}, your PackZen booking ${d.bookingRef} has been cancelled. Refund (if any) in 5-7 business days. Queries: 9945095453`,
  damage_claim:         d => `Hi ${d.name}, your damage claim (${d.claimId}) for booking ${d.bookingRef} has been received. We'll respond within 3 business days.`,
  reschedule_confirmed: d => `Hi ${d.name}, your PackZen booking ${d.bookingRef} has been rescheduled to ${d.date}. Queries: 9945095453`,
};

async function queueSMS(phone, templateKey, data) {
  if (!phone || !window._firebase) return;
  const mobile   = "91" + String(phone).replace(/\D/g,"").slice(-10);
  if (mobile.length !== 12) return;
  const template = SMS_TEMPLATES[templateKey];
  if (!template) return;
  try {
    await window._firebase.db.collection("smsQueue").add({ mobile, message:template(data), template:templateKey, status:"pending", createdAt:firebase.firestore.FieldValue.serverTimestamp(), retries:0 });
  } catch(e) {}
}

function setupStatusSMS(bookingDocId, customerPhone, customerName, bookingRef) {
  if (!bookingDocId || !window._firebase) return;
  const map = { transit:"move_started", delivered:"delivered", cancelled:"cancelled" };
  let lastStatus = "";
  window._firebase.db.collection("bookings").doc(bookingDocId).onSnapshot(doc => {
    if (!doc.exists) return;
    const b = doc.data(); const status = b.status;
    if (!status || status === lastStatus) return;
    lastStatus = status;
    if (map[status]) queueSMS(b.phone||customerPhone, map[status], { name:b.customerName||customerName, bookingRef:b.bookingRef||bookingRef||bookingDocId, driverName:b.driverName||"", driverPhone:b.driverPhone||"", date:b.date||"" });
    if (status === "assigned" && b.driverName) queueSMS(b.phone||customerPhone, "driver_assigned", { name:b.customerName||customerName, bookingRef:b.bookingRef||bookingDocId, driverName:b.driverName, driverPhone:b.driverPhone||"" });
  });
}

let damageBookingDocId = "", damagePhotos = [];
function openDamageModal(bookingDocId, bookingRef) {
  damageBookingDocId = bookingDocId; damagePhotos = [];
  document.getElementById("damageBookingRef").textContent = bookingRef || bookingDocId;
  ["damageType","damageDesc"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.getElementById("damagePhotoPreview").innerHTML = "";
  document.getElementById("damageMsg").textContent = "";
  document.getElementById("damageModal").style.display = "flex";
}
function closeDamageModal() { document.getElementById("damageModal").style.display = "none"; }

function previewDamagePhotos(input) {
  const preview = document.getElementById("damagePhotoPreview");
  preview.innerHTML = ""; damagePhotos = [];
  Array.from(input.files).slice(0,5).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      damagePhotos.push(e.target.result);
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.cssText = "width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid var(--border-light)";
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

async function submitDamageClaim() {
  const damageType = document.getElementById("damageType").value;
  const damageDesc = document.getElementById("damageDesc").value.trim();
  if (!damageType) { showToast("⚠️ Please select the type of damage."); return; }
  if (!damageDesc) { showToast("⚠️ Please describe what happened."); return; }
  if (!currentUser || !window._firebase) return;
  const btn = document.getElementById("btnSubmitDamage");
  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }
  try {
    const claimRef = await window._firebase.db.collection("damageClaims").add({ bookingDocId:damageBookingDocId, customerUid:currentUser.uid, damageType, description:damageDesc, photos:damagePhotos.slice(0,5), status:"pending", createdAt:firebase.firestore.FieldValue.serverTimestamp() });
    await window._firebase.db.collection("bookings").doc(damageBookingDocId).update({ damageClaimed:true, damageClaimId:claimRef.id, damageClaimedAt:firebase.firestore.FieldValue.serverTimestamp() });
    const b = (await window._firebase.db.collection("bookings").doc(damageBookingDocId).get()).data();
    queueSMS(b?.phone||"", "damage_claim", { name:b?.customerName||"Customer", bookingRef:b?.bookingRef||damageBookingDocId, claimId:claimRef.id.slice(0,8).toUpperCase() });
    closeDamageModal(); showToast("✅ Claim submitted!"); loadUserBookings();
  } catch(e) {
    const msgEl = document.getElementById("damageMsg");
    if (msgEl) { msgEl.textContent = "Error: " + e.message; msgEl.style.color = "#dc2626"; }
  }
  finally { if (btn) { btn.textContent = "Submit Claim"; btn.disabled = false; } }
}

function toggleFaq(btn) {
  const item   = btn.closest(".faq-item");
  const isOpen = item.classList.contains("open");
  document.querySelectorAll(".faq-item.open").forEach(i => i.classList.remove("open"));
  if (!isOpen) item.classList.add("open");
}

// ─── OTP Timer for Password Reset ───────────
function _startOtpTimer() {
  clearInterval(otpTimerInterval);
  let seconds     = 60;
  const timerEl   = document.getElementById("resetOtpTimer");
  const resendBtn = document.getElementById("btnResendResetOtp");
  if (resendBtn) resendBtn.disabled = true;
  if (timerEl)   timerEl.textContent = "Resend in 60s";
  otpTimerInterval = setInterval(() => {
    seconds--;
    if (timerEl) timerEl.textContent = seconds > 0 ? `Resend in ${seconds}s` : "";
    if (seconds <= 0) {
      clearInterval(otpTimerInterval);
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

// ─── Resend Reset OTP ────────────────────────
function resendResetOTP() {
  switchPanel("panelRecover");
  document.getElementById("resetOtpInput").value = "";
  showError("recoverError", "");
  _clearResetRecaptcha();
}

// ─── Sign Out ────────────────────────────────
function signOutUser() {
  waitForFirebase(() => {
    window._firebase.auth.signOut().then(() => {
      currentUser = null;
      closeUserMenu();
      showToast("👋 Signed out successfully.");
    });
  });
}

// ─── Finalise Reset ──────────────────────────
async function _finaliseReset(auth, btn) {
  window._resetVerifiedEmail              = null;
  window._resetPhoneUser                  = null;
  window._resetConfirmationVerificationId = null;
  window._resetOtpCode                    = null;
  resetFlowPhone                          = "";
  confirmationResult                      = null;
  if (btn) { btn.disabled = false; btn.textContent = "Set New Password →"; }
  setTimeout(() => { auth.signOut().catch(() => {}); }, 800);
  showToast("✅ Password updated! Please login with your new password.");
  closeAuthModal();
  setTimeout(() => openAuthModal("login"), 500);
}
