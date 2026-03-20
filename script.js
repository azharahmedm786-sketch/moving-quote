/* ============================================
   PackZen — script.js  (Full Feature Set)
   Dark Mode · Auth · Promo · Referral · Chat
   Checklist · Reviews · Invoice · Tracking
   Photo Upload · Payment Options
   ============================================ */

// ─── State ───────────────────────────────────
let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer; 
let pickupMarker, dropMarker;
let lastCalculatedTotal = 0;
let paymentReceiptId    = "";
let confirmationResult  = null;
let pendingSignupData   = null;
let currentUser         = null;
let otpPurpose          = "signup";
let promoDiscount       = 0;
let selectedPayment     = "at_drop";
let currentRating       = 0;
let trackingListener    = null;
let chatListener        = null;
let trackingMap         = null;
let trackingDriverMarker = null;
let currentBookingId    = null;
let uploadedPhotos      = [];
let pendingWhatsAppMsg  = null;
let pendingAdminMsg     = null;

/* ============================================
   OWNER NOTIFICATION — Auto WhatsApp on booking
   ============================================ */
const OWNER_WHATSAPP = "919945095453"; // Your WhatsApp number

function notifyOwner(bookingRef, name, phone, pickup, drop, date, total, payType, source) {
  const emoji  = source === "online" ? "💳" : source === "whatsapp" ? "📲" : "📋";
  const payLbl = source === "online"
    ? "Paid Online ✅"
    : source === "whatsapp"
    ? "WhatsApp booking"
    : "Pay on delivery";

  const msg =
    `${emoji} *New Booking Alert — PackZen* 🚚\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 *ID:* ${bookingRef}\n` +
    `👤 *Customer:* ${name}\n` +
    `📞 *Phone:* +91 ${phone}\n` +
    `📍 *Pickup:* ${pickup}\n` +
    `🏁 *Drop:* ${drop}\n` +
    `📅 *Date:* ${date || "To be confirmed"}\n` +
    `💰 *Amount:* ₹${Number(total).toLocaleString("en-IN")}\n` +
    `💳 *Payment:* ${payLbl}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Reply CONFIRM or call customer now.`;

  // Open WhatsApp to your number with the booking details
  setTimeout(() => {
    window.open(
      `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, 1500); // slight delay so the confirmation card appears first
}

const MIN_BASE_PRICE = 1999;
const FRIDGE_PRICE   = 150;
const RAZORPAY_KEY   = (window.ENV && window.ENV.RAZORPAY_KEY) || "";

/* ============================================
   UTILITY — debounce
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
  const sheet = document.getElementById(id);
  const overlay = document.getElementById("bsOverlay");
  if (!sheet || !overlay) return;

  // Build dynamic content before opening
  if (id === "bsDate")        buildBsDateStrip();
  if (id === "bsHouse")       buildBsHouseOptions();

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

/* ---------- DATE SHEET ---------- */
function buildBsDateStrip() {
  const strip = document.getElementById("bsDateStrip");
  if (!strip) return;
  strip.innerHTML = "";

  const today = new Date(); today.setHours(0,0,0,0);
  const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const selected = document.getElementById("shiftDate")?.value;

  // Also set min on date input
  const di = document.getElementById("bsDateInput");
  if (di) di.min = today.toISOString().split("T")[0];

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = d.toISOString().split("T")[0];

    const card = document.createElement("div");
    card.className = "bs-date-card" +
      (i === 0 ? " today-card" : "") +
      (ds === selected ? " selected" : "");
    card.dataset.date = ds;
    card.innerHTML = `
      <div class="bs-dc-day">${DAYS[d.getDay()]}</div>
      <div class="bs-dc-num">${d.getDate()}</div>
      <div class="bs-dc-month">${MONTHS[d.getMonth()]}</div>
      ${i === 0 ? '<div class="bs-dc-tag">Today</div>' : i === 1 ? '<div class="bs-dc-tag">Tomorrow</div>' : ''}
    `;
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
  // Deselect strip cards
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

/* ---------- TIME SHEET ---------- */
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

/* ---------- HOUSE TYPE SHEET ---------- */
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
      <div class="bs-house-card ${s.value === selected ? 'selected' : ''}"
           onclick="pickHouseType('${s.value}','${s.icon} ${s.label}','${s.label}')">
        <div class="bs-house-icon">${s.icon}</div>
        <div class="bs-house-label">${s.label}</div>
        <div class="bs-house-sub">${s.sub || ''}</div>
      </div>`).join("") + '</div>';
}

function pickHouseType(value, label, shortLabel) {
  const sel = document.getElementById("house");
  if (sel) sel.value = value;

  document.querySelectorAll(".bs-house-card").forEach(c => c.classList.remove("selected"));
  event.currentTarget.classList.add("selected");

  const trigger = document.getElementById("houseTrigger");
  const text    = document.getElementById("houseTriggerText");
  const icon    = document.getElementById("houseTrigger")?.querySelector(".bs-trigger-icon");
  if (trigger) trigger.classList.add("filled");
  if (text) text.textContent = label;

  setTimeout(() => { closeAllBottomSheets(); calculateQuote(true); }, 250);
}

/* ---------- VEHICLE SHEET ---------- */
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

/* ---------- FLOOR SHEETS ---------- */
function pickFloor(type, value, label, price) {
  const sel = document.getElementById(type === "pickup" ? "pickupFloor" : "dropFloor");
  if (sel) sel.value = value;

  const sheetId = type === "pickup" ? "bsPickupFloor" : "bsDropFloor";
  document.querySelectorAll("#" + sheetId + " .bs-option").forEach(b => b.classList.remove("selected"));
  event.currentTarget.classList.add("selected");

  const triggerId = type === "pickup" ? "pickupFloorTrigger" : "dropFloorTrigger";
  const textId    = type === "pickup" ? "pickupFloorText" : "dropFloorText";
  const trigger   = document.getElementById(triggerId);
  const text      = document.getElementById(textId);
  if (trigger) trigger.classList.add("filled");
  if (text) text.textContent = label + "  " + price;

  setTimeout(() => { closeAllBottomSheets(); calculateQuote(true); }, 250);
}

/* ---------- SWIPE TO CLOSE ---------- */
(function() {
  let startY = 0;
  document.addEventListener("touchstart", e => {
    if (e.target.closest(".bottom-sheet")) startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!_activeBs) return;
    const endY = e.changedTouches[0].clientY;
    if (endY - startY > 80) closeAllBottomSheets(); // swipe down 80px to close
  }, { passive: true });
})();

/* ============================================
   ADVANCED DATE PICKER
   ============================================ */
function buildDateStrip() {
  const strip = document.getElementById("dateStrip");
  if (!strip) return;

  strip.innerHTML = "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months= ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Show next 10 days starting from today
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
      ${i === 0 ? '<div class="dc-tag">Today</div>' : i === 1 ? '<div class="dc-tag">Tomorrow</div>' : ''}
    `;

    card.addEventListener("click", () => selectDateCard(card, d));
    strip.appendChild(card);
  }
}

function selectDateCard(card, dateObj) {
  // Deselect all
  document.querySelectorAll(".date-card").forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");

  // Set hidden input value
  const dateStr = dateObj.toISOString().split("T")[0];
  const shiftDate = document.getElementById("shiftDate");
  if (shiftDate) shiftDate.value = dateStr;

  // Update label
  const label = document.getElementById("dateSelectedLabel");
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

  // Set min date to today
  const today = new Date().toISOString().split("T")[0];
  input.min = today;
  input.style.position = "fixed";
  input.style.opacity  = "0";
  input.style.top      = "50%";
  input.style.left     = "50%";
  input.style.width    = "1px";
  input.style.height   = "1px";
  input.click();
  setTimeout(() => {
    input.style.position = "absolute";
    input.style.width    = "0";
    input.style.height   = "0";
  }, 500);
}

function onCustomDatePicked(val) {
  if (!val) return;
  const d = new Date(val + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);

  if (d < today) {
    showToast("⚠️ Please select today or a future date.");
    return;
  }

  // Deselect strip cards (custom date may not be in strip)
  document.querySelectorAll(".date-card").forEach(c => c.classList.remove("selected"));

  // Check if date is in strip — select it if so
  const dateStr = val;
  const match = document.querySelector(`.date-card[data-date="${dateStr}"]`);
  if (match) match.classList.add("selected");

  // Update label
  const label = document.getElementById("dateSelectedLabel");
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (label) {
    label.textContent = `✅ ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    label.className = "date-selected-label has-date";
  }
  calculateQuote(true);
}

function selectTimeSlot(btn, value, label, range) {
  // Deselect all time slots
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
  // Restore theme
  if (localStorage.getItem("packzen-theme") === "dark") {
    document.body.classList.add("dark-mode");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = "☀️";
  }

  // Auto-scroll focused input into view on mobile
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!["INPUT","TEXTAREA","SELECT"].includes(el.tagName)) return;
    if (window.innerWidth > 768) return;
    setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 320);
  });

  // Reveal — mark everything visible immediately, no animation dependency
  const makeVisible = () => {
    document.querySelectorAll(".reveal, .reveal-stagger").forEach(el => {
      el.classList.add("visible");
    });
  };
  makeVisible();
  // Also run after a short delay in case DOM isn't fully painted
  setTimeout(makeVisible, 100);
  setTimeout(makeVisible, 500);

  // Stats counter
  const STAT_VALUES = [100, 2026, 100, 0];
  const statNumbers = document.querySelectorAll(".stat-number");
  statNumbers.forEach((el, i) => {
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
    if (isNaN(target)) { return; }
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
      const rect = strip.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        strip.querySelectorAll(".stat-number").forEach(animateCounter);
        statsObs.unobserve(strip);
      }
    }, 500);
  }

  // Ripple
  document.querySelectorAll("button, .btn-primary, .btn-ghost").forEach(btn => {
    btn.addEventListener("click", function(e) {
      const r = document.createElement("span"); r.classList.add("ripple");
      const rect = this.getBoundingClientRect(), size = Math.max(rect.width, rect.height);
      r.style.width = r.style.height = size + "px";
      r.style.left = e.clientX - rect.left - size/2 + "px";
      r.style.top  = e.clientY - rect.top  - size/2 + "px";
      this.appendChild(r); r.addEventListener("animationend", () => r.remove());
    });
  });

  // Price pop animation
  const priceEl = document.getElementById("livePrice");
  if (priceEl) new MutationObserver(() => { priceEl.classList.remove("updated"); void priceEl.offsetWidth; priceEl.classList.add("updated"); }).observe(priceEl, { childList: true });

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", function(e) {
      const t = document.querySelector(this.getAttribute("href"));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); }
    });
  });

  // Navbar scroll
  const navbar = document.querySelector(".navbar");
  window.addEventListener("scroll", () => {
    navbar.style.background = window.scrollY > 50 ? "rgba(5,13,26,0.97)" : "rgba(5,13,26,0.85)";
  }, { passive: true });

  // Close dropdown outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-user")) document.getElementById("userDropdown")?.classList.remove("open");
  });

  // Auth state — set LOCAL persistence so login survives page refresh
  waitForFirebase(() => {
    const auth = window._firebase.auth;

    // Keep user logged in across refreshes (localStorage)
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(() => {}); // silent fallback if already set

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
  }); // end waitForFirebase

  loadReviewsPublic();
  buildChecklist();
  setTimeout(() => renderSizeCards("home"), 100);
  initPaymentOptions();
  buildDateStrip(); // Build advanced date picker

  // Inject furniture category styles
  if (!document.getElementById('pz-fc-styles')) {
    const s = document.createElement('style');
    s.id = 'pz-fc-styles';
    s.textContent = `
      .furniture-grid { display:flex; flex-direction:column; gap:8px; }
      .fc-category { border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden; }
      .fc-category-header { display:flex; align-items:center; gap:10px; padding:12px 16px; background:rgba(255,255,255,0.04); cursor:pointer; transition:background .2s; user-select:none; }
      .fc-category-header:hover { background:rgba(255,255,255,0.08); }
      .fc-cat-icon { font-size:1.1rem; }
      .fc-cat-label { flex:1; font-weight:600; font-size:.9rem; color:var(--text,#fff); }
      .fc-cat-arrow { font-size:.8rem; color:var(--text-muted,#aaa); transition:transform .2s; }
      .fc-category-items { display:none; flex-wrap:wrap; gap:8px; padding:12px; background:rgba(255,255,255,0.02); }
      .furniture-card { display:flex; flex-direction:column; align-items:center; width:80px; cursor:pointer; position:relative; }
      .furniture-card input[type=checkbox] { position:absolute; opacity:0; width:0; height:0; }
      .fc-body { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 6px; border-radius:10px; width:100%; text-align:center; border:2px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03); transition:all .2s; position:relative; }
      .furniture-card input:checked ~ .fc-body { border-color:#3b82f6; background:rgba(59,130,246,0.15); }
      .fc-check { position:absolute; top:4px; right:4px; width:16px; height:16px; background:#3b82f6; border-radius:50%; font-size:9px; color:#fff; display:flex; align-items:center; justify-content:center; opacity:0; transform:scale(0); transition:all .15s; }
      .furniture-card input:checked ~ .fc-body .fc-check { opacity:1; transform:scale(1); }
      .fc-emoji { font-size:1.5rem; line-height:1; }
      .fc-name { font-size:.72rem; font-weight:500; color:var(--text,#fff); line-height:1.2; }
      .fc-price { font-size:.68rem; color:#22c55e; font-weight:600; display:none; }
      .carton-box-row { display:flex; align-items:center; flex-wrap:wrap; gap:10px; padding:4px 0; width:100%; }
      .carton-label { font-size:.85rem; color:var(--text,#fff); flex:1; min-width:160px; }
      .carton-qty-wrap { display:flex; align-items:center; gap:6px; }
      .carton-price-note { font-size:.8rem; color:#22c55e; font-weight:600; }
    `;
    document.head.appendChild(s);
  }

  // :has() fallback for older browsers
  document.addEventListener("change", (e) => {
    if (e.target.type === "checkbox" && e.target.closest(".furniture-card")) {
      const card = e.target.closest(".furniture-card");
      card.classList.toggle("checked", e.target.checked);
    }
  });

  // ✅ FIX: Create dedicated hidden reCAPTCHA container for password reset
  if (!document.getElementById("recaptcha-reset-container")) {
    const div = document.createElement("div");
    div.id = "recaptcha-reset-container";
    div.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(div);
  }
});

/* ============================================
   Payment Options Initialisation
   ============================================ */
function initPaymentOptions() {
  const atDrop = document.getElementById("optAtDrop");
  if (atDrop) atDrop.classList.add("selected");
  document.getElementById("optAdvance")?.classList.remove("selected");
  document.getElementById("optFull")?.classList.remove("selected");
  selectedPayment = "at_drop";
}

/* ============================================
   FIREBASE HELPER
   ============================================ */
function waitForFirebase(cb, tries = 0) {
  if (window._firebase) { cb(); return; }
  if (tries > 30) { return; } // firebase timeout
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
    loginBtn.style.display = "none";
    navUser.style.display  = "flex";
    const name = user.displayName || user.email?.split("@")[0] || "User";
    navName.textContent   = name.split(" ")[0];
    navAvatar.textContent = name.charAt(0).toUpperCase();

    window._firebase.db.collection("users").doc(user.uid).get()
      .then(doc => {
        if (doc.exists && doc.data().role === "admin") {
          if (adminLink) adminLink.style.display = "block";
        }
      })
      .catch(() => {}); // silent
  } else {
    loginBtn.style.display = "inline-block";
    navUser.style.display  = "none";
  }
}

function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  const navUser  = document.getElementById("navUser");
  if (!dropdown || !navUser) return;
  const isOpen = dropdown.classList.contains("open");
  if (isOpen) { dropdown.classList.remove("open"); return; }
  const rect = navUser.getBoundingClientRect();
  dropdown.style.top   = (rect.bottom + 6) + "px";
  dropdown.style.right = (window.innerWidth - rect.right) + "px";
  dropdown.classList.add("open");
}

function closeUserMenu() {
  document.getElementById("userDropdown")?.classList.remove("open");
}

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
}

// ✅ FIX: panelResetOTP included in the list
function switchPanel(id) {
  ["panelLogin","panelSignup","panelOTP","panelRecover","panelResetOTP"].forEach(p => {
    const el = document.getElementById(p);
    if (el) el.style.display = p === id ? "block" : "none";
  });
}

function clearAuthErrors() {
  ["loginError","signupError","otpError","recoverMsg"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; el.style.color = "#e53e3e"; }
  });
}

function showError(id, msg, isSuccess = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  if (isSuccess === true)        el.style.color = "#16a34a";
  else if (isSuccess === "info") el.style.color = "#2563eb";
  else                           el.style.color = "#dc2626";
}

function getAuthErrorMessage(code) {
  const messages = {
    "auth/user-not-found":               "⚠️ No account found. Please sign up first.",
    "auth/wrong-password":               "⚠️ Incorrect password. Please try again.",
    "auth/invalid-credential":           "⚠️ Incorrect phone or password. Please try again.",
    "auth/invalid-login-credentials":    "⚠️ Incorrect phone or password. Please try again.",
    "auth/invalid-email":                "⚠️ Please enter a valid email address.",
    "auth/email-already-in-use":         "⚠️ This email is already registered. Please login.",
    "auth/weak-password":                "⚠️ Password too weak. Use at least 6 characters.",
    "auth/network-request-failed":       "⚠️ Network error. Please check your connection.",
    "auth/too-many-requests":            "⚠️ Too many attempts. Please wait a few minutes and try again.",
    "auth/invalid-phone-number":         "⚠️ Invalid phone number. Enter a valid 10-digit number.",
    "auth/operation-not-allowed":        "⚠️ Sign-in method not enabled. Contact support.",
    "auth/session-expired":              "⚠️ OTP expired. Please request a new one.",
    "auth/invalid-verification-code":    "⚠️ Invalid OTP. Please check and try again.",
    "auth/quota-exceeded":               "⚠️ SMS quota exceeded. Please try again later.",
    "auth/user-disabled":                "⚠️ This account has been disabled. Contact support.",
    "auth/requires-recent-login":        "⚠️ Please log out and log in again to continue.",
    "auth/account-exists-with-different-credential": "⚠️ Account exists with different login method.",
    "permission-denied":                 "⚠️ Access denied. Please log out and log in again.",
  };
  return messages[code] || ("⚠️ Error: " + (code || "unknown") + ". Please try again.");
}

/* ============================================
   SIGNUP
   ============================================ */
function signupUser() {
  const name     = document.getElementById("signupName").value.trim();
  const email    = document.getElementById("signupEmail").value.trim();
  const phone    = document.getElementById("signupPhone").value.trim();
  const password = document.getElementById("signupPassword").value;
  const referral = document.getElementById("signupReferral")?.value.trim().toUpperCase();

  if (!name)                        return showError("signupError", "⚠️ Please enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                                    return showError("signupError", "⚠️ Please enter a valid email address.");
  if (phone.length !== 10 || !/^\d{10}$/.test(phone))
                                    return showError("signupError", "⚠️ Please enter a valid 10-digit mobile number.");
  if (password.length < 6)          return showError("signupError", "⚠️ Password must be at least 6 characters.");

  showError("signupError", "⏳ Sending OTP to +91 " + phone + "...", true);

  const btn = document.querySelector("#panelSignup .btn-auth");
  if (btn) { btn.disabled = true; btn.textContent = "Sending OTP..."; }

  waitForFirebase(() => {
    const { auth } = window._firebase;
    pendingSignupData = { name, email, password, phone, referral };
    otpPurpose = "signup";

    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch(e) {}
      window.recaptchaVerifier = null;
    }

    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      "recaptcha-container", { size: "invisible", callback: () => {} }
    );

    window.recaptchaVerifier.render().then(() => {
      auth.signInWithPhoneNumber("+91" + phone, window.recaptchaVerifier)
        .then(result => {
          confirmationResult = result;
          document.getElementById("otpSubText").textContent = `OTP sent to +91 ${phone}. Check your messages.`;
          switchPanel("panelOTP");
          document.querySelector(".otp-box")?.focus();
          if (btn) { btn.disabled = false; btn.textContent = "Send OTP & Register →"; }
        })
        .catch(err => {
          
          try { window.recaptchaVerifier.clear(); } catch(e) {}
          window.recaptchaVerifier = null;
          showError("signupError", getAuthErrorMessage(err.code));
          if (btn) { btn.disabled = false; btn.textContent = "Send OTP & Register →"; }
        });
    }).catch(err => {
      
      showError("signupError", "reCAPTCHA error. Please refresh and try again.");
      if (btn) { btn.disabled = false; btn.textContent = "Send OTP & Register →"; }
    });
  });
}

function otpInput(el, index) {
  el.value = el.value.replace(/\D/g, "");
  if (el.value && index < 5) document.querySelectorAll(".otp-box")[index + 1]?.focus();
}

function getOTPValue() { return Array.from(document.querySelectorAll(".otp-box")).map(b => b.value).join(""); }

function verifyOTP() {
  const code = getOTPValue();
  if (code.length !== 6) return showError("otpError", "⚠️ Please enter all 6 digits of the OTP.");
  if (!confirmationResult)  return showError("otpError", "⚠️ OTP session expired. Please go back and try again.");

  const btn = document.querySelector("#panelOTP .btn-auth");
  if (btn) { btn.disabled = true; btn.textContent = "Verifying..."; }
  showError("otpError", "⏳ Verifying OTP...", "info");

  confirmationResult.confirm(code)
    .then(async result => {
      if (otpPurpose === "signup" && pendingSignupData) await completeSignup(result.user);
      if (btn) { btn.disabled = false; btn.textContent = "Verify OTP →"; }
    })
    .catch(err => {
      showError("otpError", getAuthErrorMessage(err.code));
      if (btn) { btn.disabled = false; btn.textContent = "Verify OTP →"; }
    });
}

async function completeSignup(phoneUser) {
  const { auth, db } = window._firebase;
  const { name, email, password, phone, referral } = pendingSignupData;
  try {
    await auth.signOut();
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    const refCode = cred.user.uid.slice(0, 8).toUpperCase();
    await db.collection("users").doc(cred.user.uid).set({
      name, email, phone, role: "customer",
      phoneVerified: true, prefEmail: true, prefSMS: true,
      referralCode: refCode, referralCount: 0, referralCredits: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (referral) await processReferral(referral, cred.user.uid);
    pendingSignupData = null;
    closeAuthModal();
    showToast(`👋 Welcome to PackZen, ${name}!`);
  } catch (err) {
    showError("otpError", getAuthErrorMessage(err.code));
  }
}

async function processReferral(refCode, newUserUid) {
  const { db } = window._firebase;
  try {
    const snap = await db.collection("users").where("referralCode", "==", refCode).get();
    if (!snap.empty) {
      const refDoc = snap.docs[0];
      await refDoc.ref.update({
        referralCount:   firebase.firestore.FieldValue.increment(1),
        referralCredits: firebase.firestore.FieldValue.increment(500)
      });
      await db.collection("users").doc(newUserUid).update({ referralDiscount: 500, referredBy: refCode });
    }
  } catch (e) {  }
}

function resendOTP() {
  document.querySelectorAll(".otp-box").forEach(b => b.value = "");
  showError("otpError", "");
  if (otpPurpose === "signup") switchPanel("panelSignup");
}

/* ============================================
   RESET PASSWORD OTP SYSTEM
   ✅ FULLY FIXED — Uses dedicated hidden div,
   clears old verifier safely, no modal collapse
   ============================================ */

let resetConfirmation = null;
let resetNewPassword  = null;

async function sendResetOTP() {
  const phone    = document.getElementById("resetPhone").value.trim();
  const password = document.getElementById("resetNewPassword").value;

  if (phone.length !== 10) {
    showToast("⚠️ Enter a valid 10-digit phone number");
    return;
  }
  if (password.length < 6) {
    showToast("⚠️ Password must be at least 6 characters");
    return;
  }

  const fullPhone = "+91" + phone;

  // ✅ Step 1: Clear any existing reset reCAPTCHA verifier safely
  if (window.resetRecaptchaVerifier) {
    try { window.resetRecaptchaVerifier.clear(); } catch(e) {}
    window.resetRecaptchaVerifier = null;
  }

  // ✅ Step 2: Reset the dedicated hidden container (safe — not part of modal)
  const container = document.getElementById("recaptcha-reset-container");
  if (container) container.innerHTML = "";

  // ✅ Step 3: Disable button to prevent double-clicks
  const btn = document.querySelector("#panelRecover .btn-auth");
  if (btn) { btn.disabled = true; btn.textContent = "Sending OTP..."; }

  try {
    // ✅ Step 4: Create new verifier on the dedicated hidden container
    window.resetRecaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      "recaptcha-reset-container",
      { size: "invisible", callback: () => {} }
    );

    await window.resetRecaptchaVerifier.render();

    // ✅ Step 5: Send OTP
    resetConfirmation = await firebase.auth().signInWithPhoneNumber(
      fullPhone,
      window.resetRecaptchaVerifier
    );

    resetNewPassword = password;

    // ✅ Step 6: Switch to OTP entry panel
    switchPanel("panelResetOTP");

    if (btn) { btn.disabled = false; btn.textContent = "Send OTP"; }

  } catch (err) {
    

    // ✅ Step 7: Clean up on failure so retry works
    if (window.resetRecaptchaVerifier) {
      try { window.resetRecaptchaVerifier.clear(); } catch(e) {}
      window.resetRecaptchaVerifier = null;
    }
    if (container) container.innerHTML = "";

    if (btn) { btn.disabled = false; btn.textContent = "Send OTP"; }

    showToast("❌ Failed to send OTP: " + err.message);
  }
}

async function verifyResetOTP() {
  const otp = document.getElementById("resetOTP").value.trim();

  if (!otp || otp.length !== 6) {
    showToast("⚠️ Please enter the 6-digit OTP");
    return;
  }

  if (!resetConfirmation) {
    showToast("⚠️ OTP session expired. Please go back and try again.");
    switchPanel("panelRecover");
    return;
  }

  const btn = document.querySelector("#panelResetOTP .btn-auth");
  if (btn) { btn.disabled = true; btn.textContent = "Verifying..."; }

  try {
    const result = await resetConfirmation.confirm(otp);
    const user   = result.user;

    await user.updatePassword(resetNewPassword);

    if (btn) { btn.disabled = false; btn.textContent = "Verify OTP & Reset Password"; }

    showToast("✅ Password reset successful! Please login with your new password.", 5000); switchPanel("panelLogin");
    switchPanel("panelLogin");

  } catch (err) {
    
    if (btn) { btn.disabled = false; btn.textContent = "Verify OTP & Reset Password"; }

    if (err.code === "auth/invalid-verification-code") {
      showToast("❌ Invalid OTP. Please check and try again.");
    } else if (err.code === "auth/session-expired") {
      showToast("⚠️ OTP expired. Please request a new one."); switchPanel("panelRecover");
      switchPanel("panelRecover");
    } else {
      showToast("❌ Error: " + err.message);
    }
  }
}

/* ============================================
   RESET PANEL — Eye toggle & strength meter
   ============================================ */
function toggleResetPass() {
  const input = document.getElementById("resetNewPassword");
  const icon  = document.getElementById("resetEyeIcon");
  if (!input || !icon) return;
  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    input.type = "password";
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

function updatePasswordStrength(val) {
  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const colors = ["#ef4444","#f97316","#eab308","#16a34a"];
  const labels = ["Weak","Fair","Good","Strong"];
  [1,2,3,4].forEach(i => {
    const bar = document.getElementById("sb" + i);
    if (bar) bar.style.background = i <= score ? colors[score-1] : "var(--border-light)";
  });
  const label = document.getElementById("strengthLabel");
  if (label) {
    label.textContent = val.length === 0 ? "" : (labels[score-1] || "Weak");
    label.style.color = val.length === 0 ? "" : (colors[score-1] || "#ef4444");
  }
}

/* ============================================
   LOGIN — Phone Number + Password
   ============================================ */
async function loginUser() {
  const phone = document.getElementById("loginPhone").value.trim();
  const pass  = document.getElementById("loginPassword").value;

  if (!phone || phone.length !== 10 || !/^\d{10}$/.test(phone))
    return showError("loginError", "⚠️ Please enter a valid 10-digit mobile number.");
  if (!pass)
    return showError("loginError", "⚠️ Please enter your password.");

  const btn = document.querySelector("#panelLogin .btn-auth");
  if (btn) { btn.disabled = true; btn.textContent = "Signing in..."; }
  showError("loginError", "⏳ Looking up your account...", "info");

  waitForFirebase(async () => {
    const { auth, db } = window._firebase;
    try {
      // ✅ FIX: Search both phone formats — "9742700167" and "+919742700167"
      const phoneWithPrefix    = "+91" + phone;
      const phoneWithoutPrefix = phone;

      let userDoc = null;

      // Try without prefix first
      const snap1 = await db.collection("users")
        .where("phone", "==", phoneWithoutPrefix)
        .limit(1).get();
      if (!snap1.empty) userDoc = snap1.docs[0];

      // If not found, try with +91 prefix
      if (!userDoc) {
        const snap2 = await db.collection("users")
          .where("phone", "==", phoneWithPrefix)
          .limit(1).get();
        if (!snap2.empty) userDoc = snap2.docs[0];
      }

      // Step 2: Sign in
      showError("loginError", "⏳ Signing you in...", "info");
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

      let cred = null;

      if (userDoc) {
        // Found in Firestore — use linked email
        const userData2 = userDoc.data();
        const linkedEmail = userData2.email;
        if (linkedEmail) {
          cred = await auth.signInWithEmailAndPassword(linkedEmail, pass);
        }
      }

      if (!cred) {
        // Fallback: try phone as email format (some signups use phone@packzen.in)
        const fallbackEmail = phone + "@packzen.in";
        try {
          cred = await auth.signInWithEmailAndPassword(fallbackEmail, pass);
        } catch(e2) {
          // Fallback failed - show helpful message
          if (btn) { btn.disabled = false; btn.textContent = "Login →"; }
          return showError("loginError", "⚠️ Account not found. Please sign up or check your phone number.");
        }
      }

      if (btn) { btn.disabled = false; btn.textContent = "Login →"; }
      closeAuthModal();
      const userData = userDoc ? userDoc.data() : {};
      const name = (cred.user.displayName || userData.name || "").split(" ")[0] || "there";
      showToast(`👋 Welcome back, ${name}!`);

    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = "Login →"; }
      // Show specific error based on Firebase error code
      const code = err.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
        showError("loginError", "⚠️ Incorrect password. Please try again or reset your password.");
      } else if (code === "auth/too-many-requests") {
        showError("loginError", "⚠️ Too many failed attempts. Please wait a few minutes.");
      } else if (code === "auth/network-request-failed") {
        showError("loginError", "⚠️ Network error. Please check your connection.");
      } else if (code === "auth/user-not-found") {
        showError("loginError", "⚠️ No account found with this phone number.");
      } else if (code === "permission-denied") {
        showError("loginError", "⚠️ Database access denied. Please contact support.");
      } else {
        showError("loginError", getAuthErrorMessage(code));
      }
    }
  });
}

/* ============================================
   RECOVER / RESET PASSWORD (email method)
   ============================================ */
function recoverAccount() {
  const email = document.getElementById("recoverEmail").value.trim();

  if (!email)                            return showError("recoverMsg", "⚠️ Please enter your email address.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("recoverMsg", "⚠️ Please enter a valid email address.");

  const btn = document.querySelector("#panelRecover .btn-auth");
  if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }
  showError("recoverMsg", "⏳ Sending reset link...", "info");

  waitForFirebase(() => {
    window._firebase.auth.sendPasswordResetEmail(email)
      .then(() => {
        if (btn) { btn.disabled = false; btn.textContent = "Send Reset Link →"; }
        showError("recoverMsg",
          "✅ Password reset link sent! Check your inbox (and spam/junk folder).", true);
      })
      .catch(err => {
        if (btn) { btn.disabled = false; btn.textContent = "Send Reset Link →"; }
        if (err.code === "auth/user-not-found") {
          showError("recoverMsg", "⚠️ No account found with this email address.");
        } else {
          showError("recoverMsg", getAuthErrorMessage(err.code));
        }
      });
  });
}

function signOutUser() {
  waitForFirebase(() => {
    window._firebase.auth.signOut().then(() => {
      document.getElementById("userDropdown").classList.remove("open");
      showToast("✅ Signed out successfully");
    });
  });
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
  document.getElementById("userDropdown").classList.remove("open");
  if (!currentUser) { openAuthModal("login"); return; }

  const { db } = window._firebase;
  const userSnap = await db.collection("users").doc(currentUser.uid).get();
  const userData = userSnap.data() || {};
  const name = currentUser.displayName || "User";

  document.getElementById("dashName").textContent = name;
  document.getElementById("dashEmail").textContent = currentUser.email || "";
  document.getElementById("dashAvatar").textContent = name.charAt(0).toUpperCase();

  const adminTabBtn = document.getElementById("adminTabBtn");
  if (userData.role === "admin" && adminTabBtn) {
    adminTabBtn.style.display = "inline-flex";
  }

  loadUserQuotes();
  document.getElementById("dashboardModal").style.display = "flex";
  switchDashTab("quotes", document.querySelector(".dash-tab"));
}

/* ============================================
   REFERRAL
   ============================================ */
async function loadReferralData() {
  if (!currentUser || !window._firebase) return;
  const snap = await window._firebase.db.collection("users").doc(currentUser.uid).get().catch(() => null);
  if (!snap?.exists) return;
  const d = snap.data();
  const code = d.referralCode || currentUser.uid.slice(0, 8).toUpperCase();
  document.getElementById("referralCodeText").textContent = code;
  document.getElementById("refCount").textContent    = d.referralCount   || 0;
  document.getElementById("refEarned").textContent   = "₹" + (d.referralCredits || 0);
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
        if (!refSnap.empty && currentUser) {
          if (refSnap.docs[0].id !== currentUser.uid) {
            promoDiscount = 500;
            msgEl.textContent = `🎉 Referral code applied! ₹500 discount.`;
            msgEl.className = "promo-msg promo-success";
            updatePriceDisplay();
            return;
          }
        }
        msgEl.textContent = "Invalid promo code.";
        msgEl.className = "promo-msg promo-error";
        return;
      }
      const promo = snap.data();
      if (!promo.active) { msgEl.textContent = "This promo has expired."; msgEl.className = "promo-msg promo-error"; return; }
      const discount = promo.type === "percent" ? Math.round(lastCalculatedTotal * promo.value / 100) : promo.value;
      promoDiscount = Math.min(discount, lastCalculatedTotal * 0.5);
      msgEl.textContent = `🎉 Code applied! ₹${promoDiscount} off.`;
      msgEl.className = "promo-msg promo-success";
      updatePriceDisplay();
    } catch (e) { msgEl.textContent = "Error checking code."; msgEl.className = "promo-msg promo-error"; }
  });
}

/* ============================================
   updatePriceDisplay
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

  const discounted   = Math.max(lastCalculatedTotal - promoDiscount, 0);
  const fullDiscount = Math.round(discounted * 0.07);
  const fullAmount   = discounted - fullDiscount;
  const advanceAmt   = Math.round(discounted * 0.10);

  priceEl.textContent = "₹" + discounted.toLocaleString("en-IN");
  if (advanceEl) advanceEl.textContent = "₹" + advanceAmt.toLocaleString("en-IN");

  if (optAdv)    optAdv.textContent    = "₹" + advanceAmt.toLocaleString("en-IN");
  if (optFull)   optFull.textContent   = "₹" + fullAmount.toLocaleString("en-IN");
  if (optAtDrop) optAtDrop.textContent = "₹" + discounted.toLocaleString("en-IN");

  if (promoDiscount > 0 && discRow) {
    discRow.style.display = "block";
    if (discAmt) discAmt.textContent = "₹" + promoDiscount.toLocaleString("en-IN");
  }

  syncPayOnlineButton(discounted, advanceAmt, fullAmount);
}

function syncPayOnlineButton(total, advanceAmt, fullAmt) {
  const btn = document.getElementById("btnPayOnline");
  if (!btn) return;
  if (selectedPayment === "advance") {
    btn.innerHTML = `💳 Pay Advance ₹${advanceAmt.toLocaleString("en-IN")} Online`;
  } else if (selectedPayment === "full") {
    btn.innerHTML = `💳 Pay Full ₹${fullAmt.toLocaleString("en-IN")} (Save 7%)`;
  } else {
    btn.innerHTML = `💳 Pay Online`;
  }
}

/* ============================================
   selectPayment
   ============================================ */
function selectPayment(type) {
  selectedPayment = type;

  ["optAdvance","optFull","optAtDrop"].forEach(id => {
    document.getElementById(id)?.classList.remove("selected");
  });
  const map = { advance: "optAdvance", full: "optFull", at_drop: "optAtDrop" };
  document.getElementById(map[type])?.classList.add("selected");

  const discounted = Math.max(lastCalculatedTotal - promoDiscount, 0);
  const advanceAmt = Math.round(discounted * 0.10);
  const fullAmt    = Math.round(discounted * 0.93);
  syncPayOnlineButton(discounted, advanceAmt, fullAmt);
}

function startRazorpayPayment() { startPayment(); }

/* ============================================
   PHOTO UPLOAD
   ============================================ */
function previewPhotos(input) {
  const previews = document.getElementById("photoPreviews");
  previews.innerHTML = "";
  uploadedPhotos = [];
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      uploadedPhotos.push(e.target.result);
      const img = document.createElement("img");
      img.src = e.target.result;
      img.className = "photo-thumb";
      previews.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

/* ============================================
   SAVE QUOTE TO FIRESTORE
   ============================================ */
async function saveQuoteToFirestore(total) {
  if (!currentUser || !window._firebase) return;
  const { db } = window._firebase;
  const houseEl   = document.getElementById("house");
  const vehicleEl = document.getElementById("vehicle");
  const pickup    = document.getElementById("pickup");
  const drop      = document.getElementById("drop");
  try {
    await db.collection("quotes").add({
      uid:     currentUser.uid,
      pickup:  pickup?.value  || "",
      drop:    drop?.value    || "",
      house:   houseEl?.options[houseEl?.selectedIndex]?.text    || "",
      vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text || "",
      total, date: new Date().toLocaleDateString("en-IN"),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {  }
}

/* ============================================
   GOOGLE MAPS + AUTOCOMPLETE
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
      if (!navigator.geolocation) { showToast("⚠️ Location not supported by this browser."); toggle.checked = false; return; }
      pickupInput.value = "📍 Getting your location...";
      navigator.geolocation.getCurrentPosition(
        pos => {
          const latLng = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
          new google.maps.Geocoder().geocode({ location: latLng }, (res, status) => {
            if (status === "OK" && res[0]) {
              pickupInput.value = res[0].formatted_address;
              pickupPlace = { geometry: { location: latLng } };
              showLocation("pickup"); calculateQuote(true);
            } else { pickupInput.value = ""; toggle.checked = false; showToast("⚠️ Could not get address. Please type it manually."); }
          });
        },
        err => { pickupInput.value = ""; toggle.checked = false; showToast("❌ Location error: " + err.message); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
  attachAutoCalculation();
}

function attachAutoCalculation() {
  ["house","vehicle","pickupFloor","dropFloor","liftAvailable","cartonQty"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => calculateQuote(true));
  });
  document.querySelector(".furniture-grid")?.addEventListener("change", () => calculateQuote(true));
}

function showLocation(type) {
  const mapDiv = document.getElementById("map");
  const place  = type === "pickup" ? pickupPlace : dropPlace;
  if (!place?.geometry) return;
  const loc = place.geometry.location;
  if (!map) {
    mapDiv.style.display = "block";
    mapDiv.style.height  = "200px";
    mapDiv.style.maxHeight = "200px";
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
   PRICE CALCULATION
   ============================================ */
function calculateQuote(auto = false) {
  const pickup  = document.getElementById("pickup");
  const drop    = document.getElementById("drop");
  const house   = document.getElementById("house");
  const vehicle = document.getElementById("vehicle");
  const result  = document.getElementById("result");
  if (!pickup?.value || !drop?.value)        { if (!auto) showToast("📍 Please enter pickup & drop locations."); return; }
  const houseBase   = Number(house?.value   || 0);
  const vehicleRate = Number(vehicle?.value || 0);
  if (!houseBase || (!isIntercityMove && !vehicleRate)) { if (!auto) showToast("🏠 Please select house type and vehicle."); return; }

  const chargedItems = ["sofaCheck","tvCheck","tvUnitCheck","coffeeCheck","acCheck","bedCheck","wardrobeCheck","dressingCheck","sideTableCheck"];
  let itemCount = 0;
  chargedItems.forEach(id => { if (document.getElementById(id)?.checked) itemCount++; });
  const cartonQty    = parseInt(document.getElementById("cartonQty")?.value || 0);
  const cartonCost   = cartonQty * 50;
  const furnitureCost = (itemCount * 150) + cartonCost;

  function applyPrice(km) {
    const pickupFloor = Number(document.getElementById("pickupFloor")?.value  || 0);
    const dropFloor   = Number(document.getElementById("dropFloor")?.value    || 0);
    const liftAvail   = document.getElementById("liftAvailable")?.checked;
    const packingCost = 0;
    const floorCost   = liftAvail ? Math.round((pickupFloor + dropFloor) * 0.5) : (pickupFloor + dropFloor);

    detectAndShowIntercityBadge(km);

    let total, breakdownHtml;

    if (km > 100) {
      const baseRate  = getIntercityBase(house?.value || "3950", km);
      total = Math.round(baseRate + furnitureCost + floorCost + packingCost);
      const distLabel = km <= 400 ? "up to 400 km" : km <= 600 ? "up to 600 km" : km <= 1000 ? "up to 1000 km" : "1000+ km";
      breakdownHtml =
        `🚛 Intercity · ~${Math.round(km)} km (${distLabel})<br>` +
        `Base: ₹${baseRate.toLocaleString("en-IN")}` +
        `${itemCount  ? ` · Items (${itemCount} × ₹150): ₹${(itemCount*150).toLocaleString("en-IN")}` : ""}` +
        `${cartonQty  ? ` · Cartons (${cartonQty} × ₹50): ₹${cartonCost.toLocaleString("en-IN")}`    : ""}` +
        `${floorCost  ? ` · Floor: ₹${floorCost.toLocaleString("en-IN")}`                             : ""}` +
        `<br><strong>Total Estimate: ₹${total.toLocaleString("en-IN")}</strong>`;
    } else {
      const vehicleVal = Number(vehicle?.value || 0);
      let baseFare, perKmRate;
      if      (vehicleVal === 88) { baseFare = 7500; perKmRate = 40; }
      else if (vehicleVal === 69) { baseFare = 6000; perKmRate = 35; }
      else if (vehicleVal === 54) { baseFare = 4500; perKmRate = 35; }
      else                        { baseFare = 1999; perKmRate = 25; }

      const distanceFare = km <= 25 ? baseFare : baseFare + ((km - 25) * perKmRate);
      total = Math.round(distanceFare + furnitureCost + floorCost + packingCost);

      breakdownHtml =
        `📍 Local · ~${km.toFixed(1)} km<br>` +
        `Base fare: ₹${baseFare.toLocaleString("en-IN")}` +
        `${km > 25    ? ` · Extra km: ₹${Math.round((km-25)*perKmRate).toLocaleString("en-IN")}` : ""}` +
        `${itemCount  ? ` · Items (${itemCount} × ₹150): ₹${(itemCount*150).toLocaleString("en-IN")}` : ""}` +
        `${cartonQty  ? ` · Cartons (${cartonQty} × ₹50): ₹${cartonCost.toLocaleString("en-IN")}` : ""}` +
        `${floorCost  ? ` · Floor: ₹${floorCost.toLocaleString("en-IN")}` : ""}` +
        `<br><strong>Total Estimate: ₹${total.toLocaleString("en-IN")}</strong>`;
    }

    if (result) result.innerHTML = breakdownHtml;
    lastCalculatedTotal = total;
    updatePriceDisplay();
    if (currentUser) saveQuoteToFirestore(total);
  }

  try {
    new google.maps.DistanceMatrixService().getDistanceMatrix({
      origins: [pickup.value], destinations: [drop.value], travelMode: "DRIVING"
    }, (res, status) => {
      const el = res?.rows?.[0]?.elements?.[0];
      if (status === "OK" && el?.status === "OK" && el?.distance?.value) {
        applyPrice(el.distance.value / 1000);
      } else {
        if (pickupPlace?.geometry && dropPlace?.geometry) {
          const R = 6371;
          const p1 = pickupPlace.geometry.location, p2 = dropPlace.geometry.location;
          const lat1 = p1.lat() * Math.PI/180, lat2 = p2.lat() * Math.PI/180;
          const dLat = lat2 - lat1, dLng = (p2.lng() - p1.lng()) * Math.PI/180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
          const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3;
          applyPrice(Math.max(km, 5));
        } else { applyPrice(15); }
      }
    });
  } catch(e) { applyPrice(15); }
}

/* ============================================
   WHATSAPP BOOKING
   ============================================ */
function saveLead() {
  const custName  = document.getElementById("custName");
  const custPhone = document.getElementById("custPhone");
  const pickup    = document.getElementById("pickup");
  const drop      = document.getElementById("drop");
  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec", {
    method: "POST", body: JSON.stringify({ name: custName?.value||"", phone: custPhone?.value||"", pickup: pickup?.value||"", drop: drop?.value||"" })
  }).catch(() => {});
}

async function bookOnWhatsApp() {
  if (!currentUser) { showToast("👋 Please login or create an account to book."); openAuthModal("login"); return; }
  const name  = document.getElementById("custName")?.value?.trim();
  const phone = document.getElementById("custPhone")?.value?.trim();
  if (!name)                       return showToast("⚠️ Please enter your name.");
  if (!phone || phone.length < 10) return showToast("⚠️ Please enter a valid phone number.");
  if (lastCalculatedTotal === 0)   return showToast("⚠️ Price not calculated yet. Please enter pickup & drop locations.");

  saveLead();
  const pickup      = document.getElementById("pickup")?.value  || "";
  const drop        = document.getElementById("drop")?.value    || "";
  const date        = document.getElementById("shiftDate")?.value || "";
  const house       = document.getElementById("house");
  const vehicle     = document.getElementById("vehicle");
  const houseText   = house?.options[house?.selectedIndex]?.text    || "";
  const vehicleText = vehicle?.options[vehicle?.selectedIndex]?.text || "";
  const bookingRef  = "WA-" + Date.now().toString(36).toUpperCase();
  const discountedTotal = Math.max(lastCalculatedTotal - promoDiscount, 0);

  if (window._firebase) {
    try {
      showToast("⏳ Saving booking...");
      const docRef = await window._firebase.db.collection("bookings").add({
        bookingRef, customerUid: currentUser.uid,
        customerName: name, phone, pickup, drop, date,
        moveType: selectedMoveType, house: houseText, vehicle: vehicleText,
        furniture: getFurnitureSummary(),
        pickupFloor: document.getElementById("pickupFloor")?.options[document.getElementById("pickupFloor")?.selectedIndex]?.text || "",
        dropFloor: document.getElementById("dropFloor")?.options[document.getElementById("dropFloor")?.selectedIndex]?.text || "",
        liftAvailable: !!document.getElementById("liftAvailable")?.checked,
        packingService: false,
        total: discountedTotal, originalTotal: lastCalculatedTotal,
        paid: 0, status: "confirmed", source: "whatsapp",
        promoDiscount, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      currentBookingId = docRef.id;
      localStorage.setItem("packzen_active_booking", docRef.id);
      queueSMS(phone, "booking_confirmed", { name, bookingRef, date, pickup, total: discountedTotal });
      notifyOwner(bookingRef, name, phone, pickup, drop, date, discountedTotal, "pay_later", "whatsapp");

      showConfirmationCard({
        bookingRef, name, phone, pickup, drop, date,
        house: houseText || "—", vehicle: vehicleText || "—",
        total: discountedTotal, paymentLabel: "Cash on moving day",
        paymentNote: "Our team will confirm your slot shortly",
        source: "whatsapp", showInvoice: false
      });

      pendingWhatsAppMsg =
        "✅ *New Booking — PackZen*\n━━━━━━━━━━━━━━━━━━━━\n" +
        `🔖 *Booking ID:* ${bookingRef}\n👤 *Name:* ${name}\n📞 *Phone:* ${phone}\n` +
        `📍 *Pickup:* ${pickup}\n🏁 *Drop:* ${drop}\n📅 *Date:* ${date||"TBD"}\n` +
        `🏠 *House:* ${houseText||"—"}\n🚚 *Vehicle:* ${vehicleText||"—"}\n` +
        `💰 *Estimate:* ₹${discountedTotal.toLocaleString("en-IN")}\n━━━━━━━━━━━━━━━━━━━━\nPayment: Cash on moving day`;
      pendingAdminMsg = pendingWhatsAppMsg;
    } catch(e) { showToast("❌ Booking save failed: " + e.message); }
  } else { showToast("⚠️ Service not ready. Please refresh and try again."); }
}

/* ============================================
   RAZORPAY PAYMENT
   ============================================ */
function startPayment() {
  if (!currentUser) { showToast("👋 Please login or create an account to book."); openAuthModal("login"); return; }
  if (!document.getElementById("tncAccepted")?.checked) { showToast("⚠️ Please accept the Terms & Conditions."); return; }
  const name  = document.getElementById("custName")?.value?.trim();
  const phone = document.getElementById("custPhone")?.value?.trim();
  if (!name)  return showToast("⚠️ Please enter your name.");
  if (!phone || phone.length < 10) return showToast("⚠️ Please enter a valid phone number.");
  if (lastCalculatedTotal === 0)   return showToast("⚠️ Price not calculated yet. Please enter pickup & drop locations.");
  if (!RAZORPAY_KEY) { showToast("⚠️ Payment not configured. Please contact support."); return; }

  const discounted = Math.max(lastCalculatedTotal - promoDiscount, 0);
  if (selectedPayment === "at_drop") { bookWithoutPayment(); return; }

  let payAmount;
  if (selectedPayment === "full")    payAmount = Math.round(discounted * 0.93);
  else                               payAmount = Math.round(discounted * 0.10);
  paymentReceiptId = "PKZ-" + Date.now();

  const rzp = new Razorpay({
    key: RAZORPAY_KEY, amount: payAmount * 100, currency: "INR",
    name: "PackZen Packers & Movers",
    description: selectedPayment === "full" ? "Full Payment (7% off)" : `Advance 10% of ₹${discounted.toLocaleString("en-IN")}`,
    receipt: paymentReceiptId,
    prefill: { name, contact: phone },
    theme: { color: "#ea580c" },
    handler: (response) => onPaymentSuccess(response, name, phone, payAmount, discounted),
    modal: { ondismiss: () => {} }
  });
  rzp.open();
  rzp.on("payment.failed", r => showToast("❌ Payment failed: " + r.error.description));
}

function onPaymentSuccess(response, name, phone, paid, total) {
  const pickup    = document.getElementById("pickup");
  const drop      = document.getElementById("drop");
  const shiftDate = document.getElementById("shiftDate");
  const bookingRef = "PKZ-" + Date.now().toString(36).toUpperCase();
  const houseEl   = document.getElementById("house");
  const vehicleEl = document.getElementById("vehicle");

  showConfirmationCard({
    bookingRef, name, phone,
    pickup: pickup?.value || "—", drop: drop?.value || "—",
    date: shiftDate?.value || "TBD",
    house: houseEl?.options[houseEl?.selectedIndex]?.text || "—",
    vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text || "—",
    total,
    paymentLabel: selectedPayment === "full" ? `Paid Full — ₹${paid.toLocaleString("en-IN")}` : `Advance ₹${paid.toLocaleString("en-IN")} paid`,
    paymentNote: `Payment ID: ${response.razorpay_payment_id}`,
    source: "payment", showInvoice: true
  });

  if (window._firebase) {
    window._firebase.db.collection("bookings").add({
      bookingRef, customerUid: currentUser.uid, customerName: name, phone,
      pickup: pickup?.value||"", drop: drop?.value||"",
      moveType: selectedMoveType,
      house: houseEl?.options[houseEl?.selectedIndex]?.text || "",
      vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text || "",
      furniture: getFurnitureSummary(),
      pickupFloor: document.getElementById("pickupFloor")?.options[document.getElementById("pickupFloor")?.selectedIndex]?.text || "",
      dropFloor: document.getElementById("dropFloor")?.options[document.getElementById("dropFloor")?.selectedIndex]?.text || "",
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
      queueSMS(phone, "booking_confirmed", {
        name, bookingRef, date: shiftDate?.value || "TBD",
        pickup: pickup?.value || "", total
      });
      notifyOwner(bookingRef, name, phone, pickup?.value || "—", drop?.value || "—", shiftDate?.value || "TBD", total, selectedPayment, "online");
    }).catch(() => {}); // silent
  }
}

function downloadInvoice() {
  if (typeof jspdf === "undefined" && typeof window.jspdf === "undefined") {
    showToast("⚠️ PDF library loading... try again in a moment.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const now = new Date();

  const bookingId = document.getElementById("bookingIdDisplay")?.textContent || paymentReceiptId || "—";
  const custName  = document.getElementById("ccName")?.textContent    || "—";
  const custPhone = document.getElementById("ccPhone")?.textContent   || "—";
  const pickup    = document.getElementById("ccPickup")?.textContent  || "—";
  const drop      = document.getElementById("ccDrop")?.textContent    || "—";
  const moveDate  = document.getElementById("ccDate")?.textContent    || "—";
  const houseType = document.getElementById("ccHouse")?.textContent   || "—";
  const vehicle   = document.getElementById("ccVehicle")?.textContent || "—";
  const payment   = document.getElementById("ccPayment")?.textContent || "—";
  const amount    = document.getElementById("ccAmount")?.textContent  || "₹0";

  doc.setFillColor(234, 88, 12); doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont("helvetica","bold");
  doc.text("PackZen Packers & Movers", 14, 15);
  doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text("GST Invoice", 14, 22);

  doc.setTextColor(0,0,0); doc.setFontSize(11);
  doc.text("Invoice No: " + bookingId, 14, 42);
  doc.text("Date: " + now.toLocaleDateString("en-IN"), 14, 50);
  const gstin = (window.ENV && window.ENV.GSTIN) ? window.ENV.GSTIN : "";
  if (gstin) doc.text("GSTIN: " + gstin, 14, 58);

  doc.setFillColor(240, 247, 255); doc.rect(14, 65, 182, 8, "F");
  doc.setFont("helvetica","bold"); doc.text("Booking Details", 16, 71);
  doc.setFont("helvetica","normal");

  const lines = [
    "Customer Name : " + custName,
    "Phone         : " + custPhone,
    "Pickup        : " + pickup,
    "Drop          : " + drop,
    "Move Date     : " + moveDate,
    "House Type    : " + houseType,
    "Vehicle       : " + vehicle,
    "Payment Type  : " + payment,
    "Total Amount  : " + amount,
  ];

  let y = 82;
  lines.forEach(line => { doc.text(line, 14, y); y += 9; });
  y += 4;
  doc.setFillColor(234, 88, 12); doc.setTextColor(255,255,255);
  doc.rect(14, y, 182, 10, "F");
  doc.setFont("helvetica","bold");
  doc.text("Total includes 18% GST as applicable", 16, y + 7);
  doc.setTextColor(100,100,100); doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text("PackZen Packers & Movers | HSR Layout, Bangalore | Ph: 9945095453 | packzenblr.in", 14, 285);
  doc.save("PackZen-Invoice-" + bookingId + ".pdf");
}

function sendWhatsAppAfterPayment() {
  if (pendingWhatsAppMsg) {
    window.open(`https://wa.me/919945095453?text=${encodeURIComponent(pendingWhatsAppMsg)}`, "_blank");
    if (pendingAdminMsg && pendingAdminMsg !== pendingWhatsAppMsg) {
      setTimeout(() => window.open(`https://wa.me/919945095453?text=${encodeURIComponent(pendingAdminMsg)}`, "_blank"), 800);
    }
    pendingWhatsAppMsg = null; pendingAdminMsg = null;
    return;
  }
  const pickup = document.getElementById("pickup");
  const drop   = document.getElementById("drop");
  const name   = document.getElementById("custName")?.value?.trim() || "—";
  const phone  = document.getElementById("custPhone")?.value?.trim() || "";
  const bookingId = document.getElementById("bookingIdDisplay")?.textContent || paymentReceiptId || "—";
  const msg =
    `✅ *Booking Confirmed — PackZen* 🚚\n\n` +
    `📌 *Booking ID:* ${bookingId}\n👤 *Name:* ${name}\n` +
    `📍 *Pickup:* ${pickup?.value||"—"}\n🏁 *Drop:* ${drop?.value||"—"}\n` +
    `💰 *Total:* ₹${lastCalculatedTotal.toLocaleString("en-IN")}\n` +
    `💳 *Payment ID:* ${paymentReceiptId||"—"}\n\n— PackZen Packers & Movers | 📞 9945095453`;
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
}

/* ============================================
   BOOKING CONFIRMATION CARD
   ============================================ */
function showConfirmationCard({ bookingRef, name, phone, pickup, drop, date, house, vehicle, total, paymentLabel, paymentNote, source, showInvoice }) {
  const idEl = document.getElementById("bookingIdDisplay");
  if (idEl) idEl.textContent = bookingRef || "—";

  const titleEl = document.getElementById("ccTitle");
  const subEl   = document.getElementById("ccSubtitle");
  if (titleEl) titleEl.textContent = source === "whatsapp" ? "Request Sent!" : "Booking Confirmed!";
  if (subEl)   subEl.textContent   = source === "whatsapp" ? "Our team will call you shortly." : "We'll call you within 30 minutes.";

  const pickupShort = (pickup||"—").split(",")[0];
  const dropShort   = (drop||"—").split(",")[0];
  const pickupShortEl = document.getElementById("ccPickupShort");
  const dropShortEl   = document.getElementById("ccDropShort");
  if (pickupShortEl) pickupShortEl.textContent = pickupShort;
  if (dropShortEl)   dropShortEl.textContent   = dropShort;

  const dateEl = document.getElementById("ccDate");
  if (dateEl) dateEl.textContent = date || "TBD";

  const amtEl = document.getElementById("ccAmount");
  if (amtEl) amtEl.textContent = "₹" + (total || 0).toLocaleString("en-IN");

  const noteEl = document.getElementById("ccPriceNote");
  if (noteEl) noteEl.textContent = paymentNote || "Pay on delivery";

  const pickupEl = document.getElementById("ccPickup");
  const dropEl   = document.getElementById("ccDrop");
  if (pickupEl) pickupEl.textContent = pickup || "—";
  if (dropEl)   dropEl.textContent   = drop   || "—";

  const fields = { ccName: name, ccPhone: phone, ccHouse: house||"—", ccVehicle: vehicle||"—", ccPayment: paymentLabel||"Pay on delivery" };
  Object.entries(fields).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });

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
  const bookingId = document.getElementById("bookingIdDisplay")?.textContent || "—";
  const bsId = document.getElementById("bsBookingId");
  if (bsId) bsId.textContent = bookingId;
}

function scrollToTrackBanner() {
  const banner = document.getElementById("trackOrderBanner");
  if (banner) {
    const navH = document.querySelector("nav")?.offsetHeight || 65;
    const top  = banner.getBoundingClientRect().top + window.scrollY - navH - 8;
    window.scrollTo({ top, behavior: "smooth" });
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
  ["custName","custPhone","promoCode"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.querySelectorAll(".move-type-card").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(".select-card, .vehicle-card").forEach(c => c.classList.remove("selected"));
  selectedMoveType = null;
  const mapDiv = document.getElementById("map");
  if (mapDiv) { mapDiv.style.display = "none"; mapDiv.style.height = "0"; }
  const tc = document.getElementById("agreeTerms");
  if (tc) tc.checked = false;
  promoDiscount = 0;
  lastCalculatedTotal = 0;
  updatePriceDisplay();
  initPaymentOptions();
  setTimeout(() => renderSizeCards("home"), 100);
}

function showTrackOrderBanner() {
  const banner = document.getElementById("trackOrderBanner");
  if (!banner) return;
  const bookingId = document.getElementById("bookingIdDisplay")?.textContent || "—";
  const tobId = document.getElementById("tobBookingId");
  if (tobId) tobId.textContent = bookingId;
  banner.style.display = "block";
  setTimeout(() => {
    const quoteSection = document.getElementById("quote");
    if (quoteSection) {
      const navH = document.querySelector("nav")?.offsetHeight || 65;
      const top  = quoteSection.getBoundingClientRect().top + window.scrollY - navH - 10;
      window.scrollTo({ top, behavior: "smooth" });
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
    if (i < idx)  step.classList.add("done");
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
    banner.style.background = "linear-gradient(135deg, #15803d, #16a34a)";
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
        } else { localStorage.removeItem("packzen_active_booking"); }
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
  } catch(e) {  }
}

function dismissTrackBanner() {
  const banner = document.getElementById("trackOrderBanner");
  if (banner) banner.style.display = "none";
}

function openTrackingOrLogin() {
  if (!currentUser) { showToast("💡 Create an account to track your booking anytime!"); openAuthModal("login"); return; }
  openTrackingModal();
}

/* ============================================
   TRACKING MODAL
   ============================================ */
function openTrackingModal() {
  document.getElementById("userDropdown").classList.remove("open");
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
  document.getElementById("trackingBookingId").textContent = "#" + b.id.slice(-6).toUpperCase();
  document.getElementById("trackStatus").textContent      = capitalize(b.status||"confirmed");
  document.getElementById("trackDriver").textContent      = b.driverName   || "Not yet assigned";
  document.getElementById("trackDriverPhone").textContent  = b.driverPhone  || "—";
  document.getElementById("trackDate").textContent        = b.date          || "—";
  document.getElementById("trackPickup").textContent      = b.pickup        || "—";
  document.getElementById("trackDrop").textContent        = b.drop          || "—";

  const order = ["confirmed","assigned","packing","transit","delivered"];
  const icons  = ["✓","🚛","📦","🚚","🎉"];
  const idx    = order.indexOf(b.status||"confirmed");
  order.forEach((s, i) => {
    const dot = document.getElementById("ts" + i);
    if (!dot) return;
    dot.className = "ts-dot";
    if (i < idx)   { dot.classList.add("done"); dot.textContent = "✓"; }
    if (i === idx)  { dot.classList.add("active"); dot.textContent = icons[i]; }
    if (i > idx)    dot.textContent = icons[i];
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
      const b = doc.data();
      const nameEl   = document.getElementById("chatDrvName");
      const statusEl = document.getElementById("chatDrvStatus");
      const avatarEl = document.getElementById("chatDrvAvatar");
      if (b.driverName) {
        if (nameEl)   nameEl.textContent   = b.driverName;
        if (statusEl) statusEl.textContent = b.driverPhone || "Your Driver";
        if (avatarEl) avatarEl.textContent = b.driverName.charAt(0).toUpperCase();
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
        const time   = msg.time?.toDate ? msg.time.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "";
        const senderLabel = (!isMine && msg.senderName) ? `<span class="chat-sender">${msg.senderName}</span>` : "";
        container.innerHTML += `
          <div class="chat-bubble ${isMine?"mine":"theirs"}">
            ${senderLabel}<div>${msg.text}</div>
            <div class="chat-time">${time}</div>
          </div>`;
      });
      container.scrollTop = container.scrollHeight;
    });
}

function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const text  = input.value.trim();
  if (!text) return;
  if (!currentBookingId) { showToast("⚠️ No active booking to chat about."); return; }
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
  "2 Weeks Before": [
    "Notify your landlord / society", "Contact PackZen for booking confirmation",
    "Start collecting packing boxes", "Sort items — keep, donate, discard",
    "Update your address with bank & insurance"
  ],
  "1 Week Before": [
    "Start packing non-essential items", "Label all boxes by room",
    "Pack fragile items with extra padding", "Defrost refrigerator",
    "Arrange for parking at both locations"
  ],
  "Moving Day": [
    "Check all rooms before leaving", "Ensure utilities are transferred",
    "Take photos of all packed items", "Keep essentials bag with you",
    "Verify all boxes are loaded", "Do a final walkthrough of old home"
  ],
  "After Moving": [
    "Unpack essentials first", "Check all items for damage",
    "Update Aadhaar address", "Connect utilities at new home",
    "Leave a review for PackZen ⭐"
  ]
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
  const check = el.querySelector(".cl-check");
  check.textContent = el.classList.contains("done") ? "✓" : "";
  updateChecklistProgress();
}

function updateChecklistProgress() {
  const saved = JSON.parse(localStorage.getItem("packzen-checklist") || "{}");
  const total = Object.values(CHECKLIST_DATA).reduce((s, a) => s + a.length, 0);
  const done  = Object.values(saved).filter(Boolean).length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  const bar   = document.getElementById("clProgressBar");
  const score = document.getElementById("clScore");
  if (bar)   bar.style.width = pct + "%";
  if (score) score.textContent = `${done} / ${total}`;
}

function openChecklist() {
  document.getElementById("userDropdown")?.classList.remove("open");
  buildChecklist();
  document.getElementById("checklistModal").style.display = "flex";
}

function closeChecklist() { document.getElementById("checklistModal").style.display = "none"; }

/* ============================================
   REVIEWS
   ============================================ */
function openReviewModal()  { document.getElementById("reviewModal").style.display = "flex"; currentRating = 0; }
function closeReviewModal() { document.getElementById("reviewModal").style.display = "none"; }

function setRating(n) {
  currentRating = n;
  document.querySelectorAll(".star-btn").forEach((btn, i) => { btn.classList.toggle("lit", i < n); });
}

async function submitReview() {
  const text = document.getElementById("reviewText").value.trim();
  const name = document.getElementById("reviewName").value.trim();
  if (!currentRating)  return showError("reviewMsg", "Please select a rating.");
  if (!text)           return showError("reviewMsg", "Please write your review.");
  if (!name)           return showError("reviewMsg", "Please enter your name.");

  waitForFirebase(async () => {
    const { db } = window._firebase;
    try {
      await db.collection("reviews").add({
        text, name, rating: currentRating,
        uid: currentUser?.uid || null, email: currentUser?.email || null,
        status: "approved", date: new Date().toLocaleDateString("en-IN"),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      closeReviewModal();
      showToast("🌟 Thank you for your review!");
      loadReviewsPublic();
    } catch (e) { showError("reviewMsg", "Error submitting: " + e.message); }
  });
}

async function loadReviewsPublic() {
  waitForFirebase(async () => {
    const { db } = window._firebase;
    try {
      const snap = await db.collection("reviews").where("status","==","approved").orderBy("createdAt","desc").limit(6).get();
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
    } catch (e) {}
  });
}

/* ============================================
   MULTI-STEP FORM
   ============================================ */
let currentStep = 0;
function getSteps() { return document.querySelectorAll(".form-step"); }

const STEP_LABELS = ["What type of move?","Where are you moving?","When & what type of move?","What are you moving?","Almost done — confirm & book"];
let selectedMoveType = "home";

const MOVE_TYPE_CONFIG = {
  home: {
    sizeLabel: "House Type", icon: "🏠",
    sizes: [
      { icon:"🏠", label:"1 RK",  sub:"Studio",  value:"1750" },
      { icon:"🏡", label:"1 BHK", sub:"Small",   value:"3950" },
      { icon:"🏘️", label:"2 BHK", sub:"Medium",  value:"5750" },
      { icon:"🏰", label:"3 BHK", sub:"Large",   value:"7450" },
      { icon:"🏯", label:"4 BHK", sub:"X-Large", value:"8350" },
      { icon:"🌇", label:"Villa", sub:"Premium", value:"10800"},
    ]
  },
  office: {
    sizeLabel: "Office Size", icon: "🏢",
    sizes: [
      { icon:"💼", label:"Cabin",    sub:"1–5 desks",   value:"5400"  },
      { icon:"🏢", label:"Small",    sub:"5–15 desks",  value:"8800"  },
      { icon:"🏬", label:"Medium",   sub:"15–30 desks", value:"13700" },
      { icon:"🏭", label:"Large",    sub:"30+ desks",   value:"21550" },
    ]
  },
  single: {
    sizeLabel: "Item Type", icon: "📦",
    sizes: [
      { icon:"🛋️", label:"Furniture", sub:"Sofa, bed…",   value:"0"   },
      { icon:"🧊", label:"Appliance", sub:"Fridge, AC…",  value:"0"   },
      { icon:"🏍️", label:"Bike/Cycle",sub:"Two-wheeler",  value:"500" },
      { icon:"📦", label:"Boxes",     sub:"Cartons",      value:"0"   },
    ]
  }
};

function updateStepDots(n) {
  document.querySelectorAll(".step-dot").forEach((dot, i) => {
    dot.classList.remove("active","done");
    if (i < n)  dot.classList.add("done");
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
      const rect    = formCard.getBoundingClientRect();
      const navH    = document.querySelector("nav")?.offsetHeight || 65;
      const scrollY = window.scrollY + rect.top - navH - 12;
      window.scrollTo({ top: scrollY, behavior: "smooth" });
    }
  }, 50);

  if (n === 2) {
    const vehicleSelect = document.getElementById("vehicle");
    if (!vehicleSelect?.value) {
      const firstCard = document.querySelector(".vehicle-card");
      if (firstCard) firstCard.click();
    }
  }
  if (n === 3) renderFurnitureGrid(selectedMoveType || "home");
  const _steps = getSteps();
  if (n === _steps.length - 1) { calculateQuote(true); autoFillCustomerDetails(); }
}

function autoFillCustomerDetails() {
  if (!currentUser || !window._firebase) return;
  const nameEl  = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  window._firebase.db.collection("users").doc(currentUser.uid).get()
    .then(doc => {
      if (!doc.exists) return;
      const d = doc.data();
      if (nameEl  && !nameEl.value.trim())  nameEl.value  = d.name  || currentUser.displayName || "";
      if (phoneEl && !phoneEl.value.trim()) phoneEl.value = d.phone || "";
    })
    .catch(() => {
      if (document.getElementById("custName") && !document.getElementById("custName").value.trim())
        document.getElementById("custName").value = currentUser.displayName || "";
    });
}

function nextStep() {
  const pickup  = document.getElementById("pickup");
  const drop    = document.getElementById("drop");
  const house   = document.getElementById("house");
  const vehicle = document.getElementById("vehicle");

  if (currentStep === 0) {
    if (!document.getElementById("moveType")?.value) { showToast("👆 Please select your move type to continue"); return; }
  }
  if (currentStep === 1) {
    let ok = true;
    if (!pickup?.value.trim()) { shakeField(pickup); showToast("📍 Please enter a pickup location"); ok = false; }
    else if (!drop?.value.trim()) { shakeField(drop); showToast("🏁 Please enter a drop location"); ok = false; }
    if (!ok) return;
  }
  if (currentStep === 2) {
    let ok = true;
    const dateVal = document.getElementById("shiftDate")?.value;
    const timeVal = document.getElementById("shiftTime")?.value;
    if (!dateVal) { showToast("📅 Please select a moving date"); ok = false; }
    else if (!timeVal) { showToast("🕐 Please select a time slot"); ok = false; }
    else if (!house?.value) { showToast("🏠 Please select your " + (selectedMoveType === "office" ? "office size" : "house type")); ok = false; }
    else if (!isIntercityMove && !vehicle?.value) { showToast("🚚 Please select a vehicle type"); ok = false; }
    if (!ok) return;
  }
  if (currentStep < getSteps().length - 1) { currentStep++; showStep(currentStep); }
}

function prevStep() {
  if (currentStep > 0) { currentStep--; showStep(currentStep); }
}

function shakeField(el) {
  if (!el) return;
  el.classList.add("error");
  setTimeout(() => el.classList.remove("error"), 600);
}

function selectMoveType(el, type) {
  selectedMoveType = type;
  document.getElementById("moveType").value = type;
  // Support both old move-type-card and new bs-move-card
  document.querySelectorAll(".move-type-card, .bs-move-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  renderSizeCards(type);
  // Reset house trigger text when move type changes
  const houseTrigger = document.getElementById("houseTrigger");
  const houseTriggerText = document.getElementById("houseTriggerText");
  if (houseTrigger) houseTrigger.classList.remove("filled");
  if (houseTriggerText) houseTriggerText.textContent = "Tap to select house type";
  const houseEl = document.getElementById("house");
  if (houseEl) houseEl.value = "";
}

function renderSizeCards(type) {
  const config = MOVE_TYPE_CONFIG[type] || MOVE_TYPE_CONFIG.home;
  const label  = document.getElementById("sizeLabelText");
  const cards  = document.getElementById("houseCards");
  const select = document.getElementById("house");
  if (label) label.textContent = config.sizeLabel;
  if (!cards) return;

  cards.innerHTML = config.sizes.map(s => `
    <div class="select-card" onclick="selectCard(this,'house','${s.value}')">
      <div class="sc-icon">${s.icon}</div>
      <div class="sc-label">${s.label}</div>
      <div class="sc-sub">${s.sub}</div>
    </div>`).join("");

  if (select) {
    select.innerHTML = '<option value="">Select size</option>' +
      config.sizes.map(s => `<option value="${s.value}">${s.label}</option>`).join("");
  }
  renderFurnitureGrid(type);
}

const FURNITURE_CATEGORIES = {
  home: [
    { id:"cat-living",  icon:"🛋️", label:"Living Room",
      items: [
        { id:"sofaCheck",      emoji:"🛋️", name:"Sofa"          },
        { id:"tvCheck",        emoji:"📺", name:"TV"            },
        { id:"tvUnitCheck",    emoji:"🗄️", name:"TV Unit"       },
        { id:"coffeeCheck",    emoji:"☕", name:"Coffee Table"  },
        { id:"acCheck",        emoji:"❄️", name:"AC Unit"       },
      ]
    },
    { id:"cat-bedroom", icon:"🛏️", label:"Bedroom",
      items: [
        { id:"bedCheck",       emoji:"🛏️", name:"Bed"           },
        { id:"wardrobeCheck",  emoji:"🚪", name:"Wardrobe"      },
        { id:"dressingCheck",  emoji:"🪞", name:"Dressing Table"},
        { id:"sideTableCheck", emoji:"🪑", name:"Side Table"    },
      ]
    },
    { id:"cat-kitchen", icon:"🍳", label:"Kitchen",
      items: [
        { id:"fridgeCheck",    emoji:"🧊", name:"Fridge"              },
        { id:"wmCheck",        emoji:"🫧", name:"Washing Machine"     },
        { id:"microwaveCheck", emoji:"📦", name:"Microwave"           },
        { id:"chimneyCheck",   emoji:"🔧", name:"Chimney"             },
        { id:"diningCheck",    emoji:"🪑", name:"Dining Table+Chairs" },
      ]
    },
    { id:"cat-other",   icon:"📦", label:"Other Items",
      items: [
        { id:"bikeCheck",  emoji:"🏍️", name:"Bike/Scooter" },
        { id:"cycleCheck", emoji:"🚲", name:"Cycle"         },
        { id:"plantCheck", emoji:"🪴", name:"Large Plants"  },
        { id:"gymCheck",   emoji:"🏋️", name:"Gym Equipment" },
      ]
    }
  ],
  office: [
    { id:"cat-workstation", icon:"🖥️", label:"Workstation",
      items: [
        { id:"deskCheck",    emoji:"🖥️", name:"Office Desk" },
        { id:"chairCheck",   emoji:"🪑", name:"Chair"        },
        { id:"serverCheck",  emoji:"💾", name:"Server/PC"    },
        { id:"printerCheck", emoji:"🖨️", name:"Printer"      },
      ]
    },
    { id:"cat-cabin", icon:"🏢", label:"Cabin / Meeting",
      items: [
        { id:"confCheck",        emoji:"📋", name:"Conference Table" },
        { id:"cabinetCheck",     emoji:"🗄️", name:"Filing Cabinet"   },
        { id:"whiteboardCheck",  emoji:"📝", name:"Whiteboard"        },
      ]
    },
    { id:"cat-appliances", icon:"❄️", label:"Appliances",
      items: [
        { id:"fridgeCheck", emoji:"🧊", name:"Fridge"            },
        { id:"acCheck",     emoji:"❄️", name:"AC Unit"           },
        { id:"wmCheck",     emoji:"🫧", name:"Washing Machine"   },
      ]
    },
    { id:"cat-other", icon:"📦", label:"Other Items",
      items: [
        { id:"plantCheck", emoji:"🪴", name:"Large Plants"   },
        { id:"gymCheck",   emoji:"🏋️", name:"Gym Equipment"  },
      ]
    }
  ]
};

function renderFurnitureGrid(type) {
  const grid = document.querySelector(".furniture-grid");
  if (!grid) return;
  const categories = FURNITURE_CATEGORIES[type] || FURNITURE_CATEGORIES.home;
  const FREE_CATS  = ["cat-kitchen","cat-other","cat-appliances"];

  const itemCard = (item, catId) => {
    const isFree = FREE_CATS.includes(catId);
    return `
    <label class="furniture-card">
      <input type="checkbox" id="${item.id}" onchange="calculateQuote(true)" aria-label="${item.name}">
      <div class="fc-body">
        <div class="fc-check">✓</div>
        <span class="fc-emoji">${item.emoji}</span>
        <span class="fc-name">${item.name}</span>
        <span class="fc-price" style="${isFree ? 'color:#94a3b8' : ''}">${isFree ? 'FREE' : '+₹150'}</span>
      </div>
    </label>`;
  };

  const categoryBlock = (cat) => `
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
        <span class="fc-cat-icon">📦</span>
        <span class="fc-cat-label">Carton Boxes (Our Service)</span>
        <span class="fc-cat-arrow" id="arrow-cat-carton">▾</span>
      </div>
      <div class="fc-category-items" id="cat-carton" style="display:flex">
        <div class="carton-box-row">
          <span class="carton-label">📦 How many carton boxes do you need?</span>
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
  const newVal = Math.max(0, Math.min(50, (parseInt(input.value) || 0) + delta));
  input.value = newVal;
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
  const newVal = Math.max(1, Math.min(9, (parseInt(input.value) || 1) + delta));
  input.value = newVal;
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
    ["dressingCheck","Dressing Table"],["sideTableCheck","Side Table"],
    ["fridgeCheck","Fridge"],["wmCheck","Washing Machine"],["microwaveCheck","Microwave"],
    ["chimneyCheck","Chimney"],["diningCheck","Dining Table"],["bikeCheck","Bike/Scooter"],
    ["cycleCheck","Cycle"],["plantCheck","Large Plants"],["gymCheck","Gym Equipment"],
    ["deskCheck","Office Desk"],["chairCheck","Chair"],["cabinetCheck","Filing Cabinet"],
    ["serverCheck","Server/PC"],["printerCheck","Printer"],["confCheck","Conf. Table"],
    ["whiteboardCheck","Whiteboard"],
  ];
  const items    = checks.filter(([id]) => document.getElementById(id)?.checked).map(([,name]) => name);
  const cartonQty = parseInt(document.getElementById("cartonQty")?.value || 0);
  if (cartonQty > 0) items.push(`Carton Boxes x${cartonQty}`);
  return items.join(", ") || "";
}

/* ============================================
   createDriver
   ============================================ */
async function createDriver() {
  if (!currentUser) { showToast("⚠️ Please login as admin."); return; }

  const name     = document.getElementById("newDriverName").value.trim();
  const email    = document.getElementById("newDriverEmail").value.trim();
  const password = document.getElementById("newDriverPassword").value.trim();
  const msg      = document.getElementById("adminMsg");

  const setMsg = (text, ok) => {
    msg.style.color = ok ? "#16a34a" : "#dc2626";
    msg.textContent = text;
  };

  if (!name)             return setMsg("⚠️ Please enter the driver's name.", false);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                         return setMsg("⚠️ Please enter a valid email address.", false);
  if (password.length < 6) return setMsg("⚠️ Password must be at least 6 characters.", false);

  const { db } = window._firebase;
  const adminSnap = await db.collection("users").doc(currentUser.uid).get();
  if (!adminSnap.exists || adminSnap.data().role !== "admin") {
    return setMsg("⚠️ Access denied. Admin role required.", false);
  }

  setMsg("⏳ Creating driver account...", true);

  try {
    const secondaryApp  = firebase.initializeApp(firebase.app().options, "driverCreation_" + Date.now());
    const secondaryAuth = secondaryApp.auth();

    const cred      = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const driverUid = cred.user.uid;

    await secondaryAuth.signOut();
    await secondaryApp.delete();

    await db.collection("users").doc(driverUid).set({
      name, email, role: "driver", isOnline: false,
      phone: "", vehicle: "", rating: 0, totalMoves: 0,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    setMsg(`✅ Driver "${name}" created! They can now log in at driver.html`, true);
    document.getElementById("newDriverName").value     = "";
    document.getElementById("newDriverEmail").value    = "";
    document.getElementById("newDriverPassword").value = "";
    showToast(`✅ Driver account created for ${name}`);

  } catch (error) {
    
    if (error.code === "auth/email-already-in-use") {
      setMsg("⚠️ A driver with this email already exists.", false);
    } else {
      setMsg("⚠️ " + (error.message || "Failed to create driver."), false);
    }
  }
}

/* ============================================
   BOOK WITHOUT PAYMENT
   ============================================ */
function bookWithoutPayment() {
  if (!currentUser) { showToast("👋 Please login or create an account to book."); openAuthModal("login"); return; }

  const nameEl  = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  const name    = nameEl?.value?.trim();
  const phone   = phoneEl?.value?.trim();

  if (!name) {
    nameEl.style.borderColor = "#e53e3e"; nameEl.focus();
    nameEl.placeholder = "⚠️ Please enter your name";
    nameEl.addEventListener("input", () => { nameEl.style.borderColor = ""; }, { once: true });
    return;
  }
  if (!phone || phone.length < 10) {
    phoneEl.style.borderColor = "#e53e3e"; phoneEl.focus();
    phoneEl.placeholder = "⚠️ Please enter valid 10-digit number";
    phoneEl.addEventListener("input", () => { phoneEl.style.borderColor = ""; }, { once: true });
    return;
  }
  if (lastCalculatedTotal === 0) { showToast("⚠️ Price not calculated yet. Please enter pickup & drop locations."); return; }

  const pickup     = document.getElementById("pickup")?.value    || "";
  const drop       = document.getElementById("drop")?.value      || "";
  const date       = document.getElementById("shiftDate")?.value || "";
  const bookingRef = "PKZ-" + Date.now().toString(36).toUpperCase().slice(-6);

  if (!window._firebase) { showToast("⚠️ Service not ready. Try again."); return; }

  const btn = document.querySelector(".btn-pay");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Saving..."; }

  const houseEl2   = document.getElementById("house");
  const vehicleEl2 = document.getElementById("vehicle");
  const discountedTotal = Math.max(lastCalculatedTotal - promoDiscount, 0);

  window._firebase.db.collection("bookings").add({
    bookingRef, customerUid: currentUser.uid, customerName: name, phone,
    pickup, drop, date, moveType: selectedMoveType,
    house:   houseEl2?.options[houseEl2?.selectedIndex]?.text    || "",
    vehicle: vehicleEl2?.options[vehicleEl2?.selectedIndex]?.text || "",
    furniture: getFurnitureSummary(),
    pickupFloor: document.getElementById("pickupFloor")?.options[document.getElementById("pickupFloor")?.selectedIndex]?.text || "",
    dropFloor: document.getElementById("dropFloor")?.options[document.getElementById("dropFloor")?.selectedIndex]?.text || "",
    liftAvailable: !!document.getElementById("liftAvailable")?.checked,
    packingService: false,
    total: discountedTotal, originalTotal: lastCalculatedTotal,
    paid: 0, paymentType: "pay_later", status: "confirmed", source: "direct",
    promoDiscount, photos: uploadedPhotos.slice(0, 3),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(docRef => {
    currentBookingId = docRef.id;
    localStorage.setItem("packzen_active_booking", docRef.id);
    if (btn) { btn.disabled = false; btn.textContent = "📋 Confirm Booking · Pay on Delivery"; }

    queueSMS(phone, "booking_confirmed", { name, bookingRef, date, pickup, total: discountedTotal });
    notifyOwner(bookingRef, name, phone, pickup, drop, date, discountedTotal, "pay_later", "direct");

    const houseEl   = document.getElementById("house");
    const vehicleEl = document.getElementById("vehicle");
    showConfirmationCard({
      bookingRef, name, phone: "+91 " + phone, pickup, drop, date,
      house:   houseEl?.options[houseEl?.selectedIndex]?.text    || "—",
      vehicle: vehicleEl?.options[vehicleEl?.selectedIndex]?.text || "—",
      total: discountedTotal, paymentLabel: "Cash on moving day",
      paymentNote: "Pay full amount to driver on moving day",
      source: "direct", showInvoice: false
    });

    pendingWhatsAppMsg =
      `✅ *Booking Confirmed — PackZen* 🚚\n\n` +
      `📌 *Booking ID:* ${bookingRef}\n👤 *Name:* ${name}\n` +
      `📍 *Pickup:* ${pickup}\n🏁 *Drop:* ${drop}\n` +
      `📅 *Date:* ${date||"To be confirmed"}\n` +
      `💰 *Estimate:* ₹${discountedTotal.toLocaleString("en-IN")}\n` +
      `💳 *Payment:* Pay on moving day\n\n` +
      `Our team will call you shortly.\n— PackZen Packers & Movers | 📞 9945095453`;

    pendingAdminMsg =
      `🔔 *New Booking (Pay Later)* — PackZen\n\n` +
      `📌 ID: ${bookingRef}\n👤 ${name} | 📞 ${phone}\n` +
      `📍 ${pickup} → ${drop}\n📅 Date: ${date||"—"}\n` +
      `💰 Estimate: ₹${discountedTotal.toLocaleString("en-IN")}`;

    showToast("✅ Booking saved! ID: " + bookingRef);
  }).catch(e => {
    if (btn) { btn.disabled = false; btn.textContent = "📋 Confirm Booking · Pay on Delivery"; }
    showToast("❌ Booking failed: " + e.message);
  });
}

function copyBookingId() {
  const id = document.getElementById("bookingIdDisplay")?.textContent;
  if (!id || id === "—") return;
  navigator.clipboard.writeText(id).then(() => showToast("✅ Booking ID copied!")).catch(() => {
    const el = document.createElement("textarea");
    el.value = id; document.body.appendChild(el); el.select();
    document.execCommand("copy"); document.body.removeChild(el);
    showToast("✅ Booking ID copied!");
  });
}

/* ============================================
   DASHBOARD FUNCTIONS
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
  window._firebase.db.collection("quotes").where("uid","==",currentUser.uid)
    .orderBy("createdAt","desc").limit(10).get()
    .then(snap => {
      const list = document.getElementById("quotesList");
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<div class="dash-empty">No saved quotes yet.</div>'; return; }
      list.innerHTML = snap.docs.map(d => {
        const q = d.data();
        return `<div class="quote-item">
          <div class="qi-route">📍 ${q.pickup||"?"} → 🏁 ${q.drop||"?"}</div>
          <div class="qi-details"><span>${q.house||"—"}</span><span>${q.vehicle||"—"}</span><span class="qi-price">₹${(q.total||0).toLocaleString("en-IN")}</span></div>
          <div class="qi-date">${q.date||""}</div>
        </div>`;
      }).join("");
    }).catch(() => {}); // silent
}

function loadUserBookings() {
  if (!currentUser || !window._firebase) return;
  const list = document.getElementById("bookingsList");
  if (list) list.innerHTML = '<div class="dash-empty" style="text-align:center;padding:20px">Loading...</div>';

  window._firebase.db.collection("bookings")
    .where("customerUid","==",currentUser.uid)
    .orderBy("createdAt","desc").limit(10).get()
    .then(snap => {
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<div class="dash-empty">No bookings yet.</div>'; return; }
      const statusColors = { confirmed:"#0057ff", assigned:"#7c3aed", packing:"#0ea5e9", transit:"#f97316", delivered:"#16a34a", pending:"#d97706", cancelled:"#dc2626" };
      const statusIcons  = { confirmed:"📋", assigned:"🚛", packing:"📦", transit:"🚚", delivered:"✅", cancelled:"❌" };
      list.innerHTML = snap.docs.map(d => {
        const b     = d.data();
        const id    = d.id;
        const color = statusColors[b.status] || "#5a6a8a";
        const icon  = statusIcons[b.status]  || "📋";
        const src   = b.source === "whatsapp" ? "💬 " : b.paymentType === "pay_later" ? "📋 " : "💳 ";
        const canCancel     = !["packing","transit","delivered","cancelled"].includes(b.status);
        const canReschedule = !["transit","delivered","cancelled"].includes(b.status);
        const canRate       = b.status === "delivered" && !b.driverRating;
        const canClaim      = b.status === "delivered" && !b.damageClaimed;
        const intercityBadge = b.isIntercity ? `<span class="bk-badge ic">🚛 Intercity</span>` : "";
        const ratingBadge    = b.driverRating ? `<span class="bk-badge rated">⭐ ${b.driverRating}/5</span>` : "";
        return `<div class="bk-card">
          <div class="bk-card-top">
            <div class="bk-route">${src}${(b.pickup||"?").split(",")[0]} → ${(b.drop||"?").split(",")[0]}</div>
            <div class="bk-status" style="color:${color}">${icon} ${capitalize(b.status||"confirmed")}</div>
          </div>
          <div class="bk-meta">
            <span>₹${(b.total||0).toLocaleString("en-IN")}</span>
            <span>${b.date||"Date TBD"}</span>
            <span style="font-size:.72rem;color:#5a6a8a">${b.bookingRef||""}</span>
            ${intercityBadge}${ratingBadge}
          </div>
          ${canCancel || canReschedule || canRate || canClaim ? `
          <div class="bk-actions">
            ${canReschedule ? `<button class="bk-btn reschedule" onclick="openRescheduleModal('${id}','${b.bookingRef||id}','${b.date||""}')">📅 Reschedule</button>` : ""}
            ${canCancel     ? `<button class="bk-btn cancel"     onclick="openCancelModal('${id}','${b.bookingRef||id}','${b.status||""}')">✕ Cancel</button>` : ""}
            ${canRate       ? `<button class="bk-btn rate"       onclick="openRateDriverModal('${id}','${b.bookingRef||id}','${b.driverName||""}')">⭐ Rate Driver</button>` : ""}
            ${canClaim      ? `<button class="bk-btn claim"      onclick="openDamageModal('${id}','${b.bookingRef||id}')">🔧 Report Damage</button>` : ""}
          </div>` : ""}
        </div>`;
      }).join("");
    }).catch(() => {}); // silent
}

function loadProfileData() {
  if (!currentUser || !window._firebase) return;
  window._firebase.db.collection("users").doc(currentUser.uid).get().then(doc => {
    if (!doc.exists) return;
    const d = doc.data();
    const nameEl      = document.getElementById("profileName");
    const emailEl     = document.getElementById("profileEmail");
    const phoneEl     = document.getElementById("profilePhone");
    const prefEmailEl = document.getElementById("prefEmail");
    const prefSMSEl   = document.getElementById("prefSMS");
    if (nameEl)      nameEl.value  = d.name  || "";
    if (emailEl)     emailEl.value = d.email || currentUser.email || "";
    if (phoneEl)     phoneEl.value = d.phone || "";
    if (prefEmailEl) prefEmailEl.checked = d.prefEmail !== false;
    if (prefSMSEl)   prefSMSEl.checked   = d.prefSMS   !== false;
  }).catch(() => {}); // silent
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
    })
    .catch(e => { if (msgEl) { msgEl.textContent = "Error: " + e.message; msgEl.style.color = "#dc2626"; } });
}

function savePreferences() {
  if (!currentUser || !window._firebase) return;
  const prefEmail = document.getElementById("prefEmail")?.checked;
  const prefSMS   = document.getElementById("prefSMS")?.checked;
  window._firebase.db.collection("users").doc(currentUser.uid).update({ prefEmail, prefSMS }).catch(() => {}); // silent
}

function openProfile() {
  document.getElementById("userDropdown")?.classList.remove("open");
  if (!currentUser) { openAuthModal("login"); return; }
  openDashboard();
  setTimeout(() => {
    const profileTab = document.querySelector(".dash-tab:nth-child(4)");
    switchDashTab("profile", profileTab);
  }, 300);
}

/* ============================================================
   INTERCITY DETECTION & PRICING
   ============================================================ */
let isIntercityMove = false;

const INTERCITY_PRICING = {
  "1750":  { "400":9000,  "600":10800, "1000":17100, "2000":24000 },
  "3950":  { "400":9000,  "600":10800, "1000":17100, "2000":24000 },
  "5750":  { "400":11000, "600":13200, "1000":20900, "2000":28000 },
  "7450":  { "400":13000, "600":15600, "1000":24700, "2000":33000 },
  "8350":  { "400":15500, "600":18600, "1000":29450, "2000":38000 },
  "10800": { "400":18000, "600":21600, "1000":34000, "2000":45000 },
  "5400":  { "400":10000, "600":12000, "1000":19000, "2000":26000 },
  "8800":  { "400":15000, "600":18000, "1000":28000, "2000":38000 },
  "13700": { "400":22000, "600":26000, "1000":40000, "2000":55000 },
  "21550": { "400":35000, "600":42000, "1000":65000, "2000":90000 },
};

function getIntercityBase(houseVal, km) {
  const tiers = INTERCITY_PRICING[String(houseVal)];
  if (!tiers) return 15000;
  if (km <= 400)  return tiers["400"];
  if (km <= 600)  return tiers["600"];
  if (km <= 1000) return tiers["1000"];
  return tiers["2000"];
}

function detectAndShowIntercityBadge(km) {
  const badge = document.getElementById("intercityBadge");
  isIntercityMove = km > 100;
  if (badge) {
    badge.style.display = isIntercityMove ? "flex" : "none";
    if (isIntercityMove) badge.querySelector(".ic-km").textContent = Math.round(km) + " km";
  }
  const vehicleGroup = document.getElementById("vehicleCardGroup");
  if (vehicleGroup) vehicleGroup.style.display = isIntercityMove ? "none" : "block";
}

/* ============================================================
   BOOKING CANCELLATION
   ============================================================ */
function openCancelModal(bookingDocId, bookingRef, status) {
  if (["packing","transit","delivered"].includes(status)) {
    showToast("❌ Cannot cancel after packing has started.");
    return;
  }
  document.getElementById("cancelBookingDocId").value = bookingDocId;
  document.getElementById("cancelBookingRef").textContent = bookingRef || bookingDocId;
  document.getElementById("cancelReason").value = "";
  document.getElementById("cancelModal").style.display = "flex";
}

function closeCancelModal() {
  document.getElementById("cancelModal").style.display = "none";
}

async function confirmCancellation() {
  const docId  = document.getElementById("cancelBookingDocId").value;
  const reason = document.getElementById("cancelReason").value.trim();
  if (!reason) { showToast("⚠️ Please select a cancellation reason."); return; }
  if (!currentUser || !window._firebase) return;

  const btn = document.getElementById("btnConfirmCancel");
  if (btn) { btn.textContent = "Cancelling..."; btn.disabled = true; }

  try {
    await window._firebase.db.collection("bookings").doc(docId).update({
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
      cancelledBy: "customer"
    });

    await window._firebase.db.collection("cancelRequests").add({
      bookingDocId: docId, reason,
      customerUid: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolved: false
    }).catch(() => {});

    closeCancelModal();
    showToast("✅ Booking cancelled. Refund (if any) processed in 5–7 business days.");
    loadUserBookings();

    if (currentBookingId === docId) {
      dismissTrackBanner();
      localStorage.removeItem("packzen_active_booking");
    }
  } catch(e) {
    showToast("❌ Error: " + e.message);
  } finally {
    if (btn) { btn.textContent = "Yes, Cancel Booking"; btn.disabled = false; }
  }
}

/* ============================================================
   BOOKING RESCHEDULE
   ============================================================ */
function openRescheduleModal(bookingDocId, bookingRef, currentDate) {
  document.getElementById("rescheduleDocId").value = bookingDocId;
  document.getElementById("rescheduleBookingRef").textContent = bookingRef || bookingDocId;
  const dateInput = document.getElementById("rescheduleDate");
  const timeInput = document.getElementById("rescheduleTime");
  if (dateInput) {
    dateInput.value = currentDate || "";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().split("T")[0];
  }
  if (timeInput) timeInput.value = "";
  document.getElementById("rescheduleModal").style.display = "flex";
}

function closeRescheduleModal() {
  document.getElementById("rescheduleModal").style.display = "none";
}

async function confirmReschedule() {
  const docId   = document.getElementById("rescheduleDocId").value;
  const newDate = document.getElementById("rescheduleDate").value;
  const newTime = document.getElementById("rescheduleTime").value;

  if (!newDate) { showToast("⚠️ Please select a new moving date."); return; }

  const selected = new Date(newDate);
  const today    = new Date(); today.setHours(0,0,0,0);
  if (selected <= today) { showToast("⚠️ Please select a future date."); return; }

  if (!currentUser || !window._firebase) return;

  const btn = document.getElementById("btnConfirmReschedule");
  if (btn) { btn.textContent = "Saving..."; btn.disabled = true; }

  try {
    await window._firebase.db.collection("bookings").doc(docId).update({
      date: newDate,
      time: newTime || "",
      rescheduledAt: firebase.firestore.FieldValue.serverTimestamp(),
      rescheduledBy: "customer",
      status: "confirmed"
    });
    closeRescheduleModal();
    showToast("✅ Booking rescheduled! We'll confirm within 2 hours.");
    loadUserBookings();
  } catch(e) {
    showToast("❌ Error: " + e.message);
  } finally {
    if (btn) { btn.textContent = "Confirm Reschedule"; btn.disabled = false; }
  }
}

/* ============================================================
   DRIVER RATING
   ============================================================ */
let ratingBookingDocId = "";
let selectedDriverRating = 0;

function openRateDriverModal(bookingDocId, bookingRef, driverName) {
  ratingBookingDocId = bookingDocId;
  selectedDriverRating = 0;
  document.getElementById("rateBookingRef").textContent  = bookingRef || bookingDocId;
  document.getElementById("rateDriverName").textContent  = driverName || "your driver";
  document.getElementById("ratingFeedback").value = "";
  document.getElementById("ratingMsg").textContent = "";
  document.querySelectorAll(".rate-star").forEach(s => s.classList.remove("active"));
  document.getElementById("rateDriverModal").style.display = "flex";
}

function closeRateDriverModal() { document.getElementById("rateDriverModal").style.display = "none"; }

function selectDriverRating(n) {
  selectedDriverRating = n;
  document.querySelectorAll(".rate-star").forEach((s, i) => s.classList.toggle("active", i < n));
}

async function submitDriverRating() {
  if (!selectedDriverRating) { showToast("⚠️ Please select a star rating."); return; }
  if (!currentUser || !window._firebase) return;
  const feedback = document.getElementById("ratingFeedback").value.trim();
  const btn = document.getElementById("btnSubmitRating");
  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }

  try {
    await window._firebase.db.collection("bookings").doc(ratingBookingDocId).update({
      driverRating: selectedDriverRating, driverFeedback: feedback,
      ratedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const bookingDoc = await window._firebase.db.collection("bookings").doc(ratingBookingDocId).get();
    const driverUid  = bookingDoc.data()?.driverUid;
    if (driverUid) {
      await window._firebase.db.collection("driverRatings").add({
        driverUid, bookingDocId: ratingBookingDocId,
        rating: selectedDriverRating, feedback,
        customerUid: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const ratingsSnap = await window._firebase.db.collection("driverRatings").where("driverUid","==",driverUid).get();
      const ratings = ratingsSnap.docs.map(d => d.data().rating);
      const avg = ratings.reduce((a,b) => a+b, 0) / ratings.length;
      await window._firebase.db.collection("drivers").doc(driverUid).update({
        avgRating: Math.round(avg * 10) / 10, totalRatings: ratings.length
      }).catch(()=>{});
    }
    closeRateDriverModal();
    showToast("⭐ Thanks for rating your driver!");
    loadUserBookings();
  } catch(e) { showToast("Error: " + e.message); }
  finally { if (btn) { btn.textContent = "Submit Rating"; btn.disabled = false; } }
}

/* ============================================================
   PUSH NOTIFICATIONS
   ============================================================ */
async function requestPushPermission() {
  if (!("Notification" in window)) return;
  if (!window._firebase?.messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const token = await window._firebase.messaging.getToken({ vapidKey: window.ENV?.FCM_VAPID_KEY || "" });
    if (token && currentUser) {
      await window._firebase.db.collection("users").doc(currentUser.uid).update({
        fcmToken: token, fcmUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch(e) {  }
}

function subscribeToBookingNotifications(bookingDocId) {
  if (!bookingDocId || !window._firebase) return;
  const statusMessages = {
    assigned: { title: "🚛 Driver Assigned!", body: "Your driver is on the way." },
    packing:  { title: "📦 Packing Started",  body: "Our team is packing your items." },
    transit:  { title: "🚚 On The Move!",     body: "Your goods are in transit." },
    delivered:{ title: "🎉 Delivered!",        body: "Your move is complete. Please rate your driver." },
    cancelled:{ title: "❌ Booking Cancelled", body: "Your booking has been cancelled." },
  };
  let lastStatus = "";
  window._firebase.db.collection("bookings").doc(bookingDocId).onSnapshot(doc => {
    if (!doc.exists) return;
    const status = doc.data().status;
    if (status && status !== lastStatus && statusMessages[status]) {
      const { title, body } = statusMessages[status];
      if (Notification.permission === "granted") new Notification(title, { body, icon: "/favicon.ico" });
      lastStatus = status;
    }
  });
  setupStatusSMS(bookingDocId, "", "", "");
}

/* ============================================================
   SMS NOTIFICATIONS
   ============================================================ */
const SMS_TEMPLATES = {
  booking_confirmed: (d) =>
    `Hi ${d.name}, your PackZen booking ${d.bookingRef} is confirmed for ${d.date}! Pickup: ${(d.pickup||"").split(",")[0]}. Est. cost: Rs.${Number(d.total).toLocaleString("en-IN")}. Track: packzenblr.in. Queries: 9945095453`,
  driver_assigned: (d) =>
    `Hi ${d.name}, your PackZen driver ${d.driverName} (${d.driverPhone}) is assigned for booking ${d.bookingRef}. Track live on packzenblr.in.`,
  move_started: (d) =>
    `Hi ${d.name}, your goods are now in transit for booking ${d.bookingRef}. Track live on packzenblr.in.`,
  delivered: (d) =>
    `Hi ${d.name}, your PackZen move ${d.bookingRef} is complete! Rate your driver on packzenblr.in. Thank you!`,
  cancelled: (d) =>
    `Hi ${d.name}, your PackZen booking ${d.bookingRef} has been cancelled. Refund (if any) in 5-7 business days.`,
  damage_claim: (d) =>
    `Hi ${d.name}, your damage claim (ID: ${d.claimId}) for booking ${d.bookingRef} has been received. We'll respond within 3 business days.`,
  reschedule_confirmed: (d) =>
    `Hi ${d.name}, your PackZen booking ${d.bookingRef} is rescheduled to ${d.date}. Queries: 9945095453`,
};

async function queueSMS(phone, templateKey, data) {
  if (!phone || !window._firebase) return;
  const mobile = "91" + String(phone).replace(/\D/g, "").slice(-10);
  if (mobile.length !== 12) return;
  const template = SMS_TEMPLATES[templateKey];
  if (!template) return;
  const message = template(data);
  try {
    await window._firebase.db.collection("smsQueue").add({
      mobile, message, template: templateKey,
      status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp(), retries: 0
    });
  } catch(e) {  }
}

function setupStatusSMS(bookingDocId, customerPhone, customerName, bookingRef) {
  if (!bookingDocId || !window._firebase) return;
  const statusSMSMap = { transit:"move_started", delivered:"delivered", cancelled:"cancelled" };
  let lastStatus = "";
  window._firebase.db.collection("bookings").doc(bookingDocId).onSnapshot(doc => {
    if (!doc.exists) return;
    const b = doc.data(); const status = b.status;
    if (!status || status === lastStatus) return;
    lastStatus = status;
    if (statusSMSMap[status]) {
      queueSMS(b.phone||customerPhone, statusSMSMap[status], {
        name: b.customerName||customerName, bookingRef: b.bookingRef||bookingRef||bookingDocId,
        driverName: b.driverName||"", driverPhone: b.driverPhone||"", date: b.date||""
      });
    }
    if (status === "assigned" && b.driverName) {
      queueSMS(b.phone||customerPhone, "driver_assigned", {
        name: b.customerName||customerName, bookingRef: b.bookingRef||bookingDocId,
        driverName: b.driverName, driverPhone: b.driverPhone||""
      });
    }
  });
}

/* ============================================================
   DAMAGE / CLAIM FLOW
   ============================================================ */
let damageBookingDocId = "";
let damagePhotos = [];

function openDamageModal(bookingDocId, bookingRef) {
  damageBookingDocId = bookingDocId; damagePhotos = [];
  document.getElementById("damageBookingRef").textContent = bookingRef || bookingDocId;
  document.getElementById("damageType").value = "";
  document.getElementById("damageDesc").value = "";
  document.getElementById("damagePhotoPreview").innerHTML = "";
  document.getElementById("damageMsg").textContent = "";
  document.getElementById("damageModal").style.display = "flex";
}

function closeDamageModal() { document.getElementById("damageModal").style.display = "none"; }

function previewDamagePhotos(input) {
  const preview = document.getElementById("damagePhotoPreview");
  preview.innerHTML = ""; damagePhotos = [];
  Array.from(input.files).slice(0, 5).forEach(file => {
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
  const msgEl      = document.getElementById("damageMsg");

  if (!damageType) { showToast("⚠️ Please select the type of damage."); return; }
  if (!damageDesc) { showToast("⚠️ Please describe what happened."); return; }
  if (!currentUser || !window._firebase) return;

  const btn = document.getElementById("btnSubmitDamage");
  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }

  try {
    const claimRef = await window._firebase.db.collection("damageClaims").add({
      bookingDocId: damageBookingDocId, customerUid: currentUser.uid,
      damageType, description: damageDesc,
      photos: damagePhotos.slice(0, 5), status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await window._firebase.db.collection("bookings").doc(damageBookingDocId).update({
      damageClaimed: true, damageClaimId: claimRef.id,
      damageClaimedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const bookingDoc = await window._firebase.db.collection("bookings").doc(damageBookingDocId).get();
    const b = bookingDoc.data();
    queueSMS(b?.phone || "", "damage_claim", {
      name: b?.customerName || "Customer",
      bookingRef: b?.bookingRef || damageBookingDocId,
      claimId: claimRef.id.slice(0,8).toUpperCase()
    });

    closeDamageModal();
    showToast("✅ Claim submitted! We'll respond within 3 business days.");
    loadUserBookings();
  } catch(e) {
    if (msgEl) { msgEl.textContent = "Error: " + e.message; msgEl.style.color = "#dc2626"; }
  } finally {
    if (btn) { btn.textContent = "Submit Claim"; btn.disabled = false; }
  }
}

/* ============================================================
   FAQ TOGGLE
   ============================================================ */
function toggleFaq(btn) {
  const item = btn.closest(".faq-item");
  const isOpen = item.classList.contains("open");
  document.querySelectorAll(".faq-item.open").forEach(i => i.classList.remove("open"));
  if (!isOpen) item.classList.add("open");
}

/* ============================================
   RESET PASSWORD — Advanced UI helpers
   ============================================ */

function toggleResetPass() {
  const input = document.getElementById("resetNewPassword");
  const icon  = document.getElementById("resetEyeIcon");
  if (!input || !icon) return;
  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    input.type = "password";
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

function updatePasswordStrength(val) {
  let score = 0;
  if (val.length >= 6)                                   score++;
  if (val.length >= 10)                                  score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val))           score++;
  if (/[^A-Za-z0-9]/.test(val))                         score++;

  const colors = ["#ef4444","#f97316","#eab308","#16a34a"];
  const labels = ["Weak","Fair","Good","Strong"];

  [1,2,3,4].forEach(i => {
    const bar = document.getElementById("sb" + i);
    if (bar) bar.style.background = i <= score ? colors[score-1] : "var(--border-light)";
  });

  const label = document.getElementById("strengthLabel");
  if (label) {
    label.textContent  = val.length === 0 ? "" : (labels[score-1] || "Weak");
    label.style.color  = val.length === 0 ? "" : (colors[score-1] || "#ef4444");
  }
}
