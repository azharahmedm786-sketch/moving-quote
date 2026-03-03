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
let selectedPayment     = "at_drop"; // Online payments coming soon — defaulting to pay at drop
let currentRating       = 0;
let trackingListener    = null;
let chatListener        = null;
let trackingMap         = null;
let trackingDriverMarker = null;
let currentBookingId    = null;
let uploadedPhotos      = []; // base64 strings
let pendingWhatsAppMsg  = null; // WA message sent when customer clicks the button
let pendingAdminMsg     = null; // Admin WA message sent when customer clicks the button

const MIN_BASE_PRICE = 1450;
const FRIDGE_PRICE   = 1450;
const RAZORPAY_KEY   = "YOUR_RAZORPAY_KEY_ID";

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
    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 320);
  });

  // Scroll Reveal
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); revealObs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal, .reveal-stagger").forEach(el => revealObs.observe(el));

  // Stats counter
  function animateCounter(el) {
    if (el.dataset.animated) return;
    el.dataset.animated = "1";
    const target = parseInt(el.dataset.target), dur = 2000, start = performance.now();
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

  // Auth state
  waitForFirebase(() => {
    window._firebase.auth.onAuthStateChanged(user => {
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


});

/* ============================================
   FIREBASE HELPER
   ============================================ */
function waitForFirebase(cb, tries = 0) {
  if (window._firebase) { cb(); return; }
  if (tries > 30) { console.warn("Firebase not loaded"); return; }
  setTimeout(() => waitForFirebase(cb, tries + 1), 200);
}

/* ============================================
   THEME TOGGLE
   ============================================ */
function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-mode");
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("packzen-theme", isDark ? "dark" : "light");
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
      .catch(err => console.error("Nav admin check error:", err));

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
function closeAuthModal() { document.getElementById("authModal").style.display = "none"; clearAuthErrors(); }
function switchPanel(id) {
  ["panelLogin","panelSignup","panelOTP","panelRecover"].forEach(p => {
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
  el.style.color = isSuccess ? "#00a357" : "#e53e3e";
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

  if (!name)                return showError("signupError", "Please enter your name.");
  if (!email.includes("@")) return showError("signupError", "Please enter a valid email.");
  if (phone.length !== 10)  return showError("signupError", "Please enter a valid 10-digit phone.");
  if (password.length < 6)  return showError("signupError", "Password must be at least 6 characters.");

  showError("signupError", "⏳ Sending OTP...", true);

  waitForFirebase(() => {
    const { auth } = window._firebase;
    pendingSignupData = { name, email, password, phone, referral };
    otpPurpose = "signup";

    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch(e) {}
      window.recaptchaVerifier = null;
    }

    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      "recaptcha-container",
      { size: "invisible", callback: () => {} }
    );

    window.recaptchaVerifier.render().then(() => {
      auth.signInWithPhoneNumber("+91" + phone, window.recaptchaVerifier)
        .then(result => {
          confirmationResult = result;
          document.getElementById("otpSubText").textContent = `OTP sent to +91 ${phone}.`;
          switchPanel("panelOTP");
          document.querySelector(".otp-box")?.focus();
        })
        .catch(err => {
          console.error("OTP send error:", err);
          try { window.recaptchaVerifier.clear(); } catch(e) {}
          window.recaptchaVerifier = null;
          if (err.code === "auth/invalid-phone-number")
            showError("signupError", "Invalid phone number. Check and try again.");
          else if (err.code === "auth/too-many-requests")
            showError("signupError", "Too many attempts. Please wait a few minutes.");
          else if (err.code === "auth/operation-not-allowed")
            showError("signupError", "Phone sign-in is not enabled. Contact support.");
          else
            showError("signupError", "OTP failed: " + err.message);
        });
    }).catch(err => {
      console.error("Recaptcha render error:", err);
      showError("signupError", "reCAPTCHA error: " + err.message);
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
  if (code.length !== 6) return showError("otpError", "Please enter all 6 digits.");
  if (!confirmationResult) return showError("otpError", "OTP session expired. Try again.");
  confirmationResult.confirm(code)
    .then(async result => { if (otpPurpose === "signup" && pendingSignupData) await completeSignup(result.user); })
    .catch(() => showError("otpError", "Invalid OTP. Please try again."));
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
    if (err.code === "auth/email-already-in-use") showError("otpError", "Email already registered. Please login.");
    else showError("otpError", "Account creation failed: " + err.message);
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
  } catch (e) { console.error("Referral error:", e); }
}

function resendOTP() {
  document.querySelectorAll(".otp-box").forEach(b => b.value = "");
  if (otpPurpose === "signup") switchPanel("panelSignup");
}

/* ============================================
   LOGIN / LOGOUT / RECOVER
   ============================================ */
function loginUser() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPassword").value;
  if (!email.includes("@")) return showError("loginError", "Please enter a valid email.");
  if (!pass)                 return showError("loginError", "Please enter your password.");
  waitForFirebase(() => {
    window._firebase.auth.signInWithEmailAndPassword(email, pass)
      .then(cred => { closeAuthModal(); showToast(`👋 Welcome back, ${cred.user.displayName || "User"}!`); })
      .catch(err => {
        if (err.code === "auth/user-not-found")      showError("loginError", "No account found.");
        else if (err.code === "auth/wrong-password") showError("loginError", "Incorrect password.");
        else showError("loginError", "Login failed. Please try again.");
      });
  });
}

function recoverAccount() {
  const email = document.getElementById("recoverEmail").value.trim();
  if (!email.includes("@")) return showError("recoverMsg", "Please enter a valid email.");
  waitForFirebase(() => {
    window._firebase.auth.sendPasswordResetEmail(email)
      .then(() => showError("recoverMsg", "✅ Reset link sent! Check your inbox.", true))
      .catch(() => showError("recoverMsg", "No account found with this email."));
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
  const userData = userSnap.data();
  const name = currentUser.displayName || "User";

  document.getElementById("dashName").textContent = name;
  document.getElementById("dashEmail").textContent = currentUser.email || "";
  document.getElementById("dashAvatar").textContent = name.charAt(0).toUpperCase();

  if (userData.role === "admin") {
    if (!document.getElementById("adminTabBtn")) {
      const tabContainer = document.querySelector(".dash-tabs");
      const btn = document.createElement("button");
      btn.className = "dash-tab";
      btn.id = "adminTabBtn";
      btn.innerText = "🛠 Admin";
      btn.onclick = function() { switchDashTab("admin", btn); };
      tabContainer.appendChild(btn);
    }
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
  document.getElementById("refCount").textContent   = d.referralCount || 0;
  document.getElementById("refEarned").textContent  = "₹" + (d.referralCredits || 0);
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
  const code = document.getElementById("promoInput").value.trim().toUpperCase();
  const msgEl = document.getElementById("promoMsg");
  if (!code) { msgEl.textContent = "Enter a promo code."; msgEl.className = "promo-msg promo-error"; return; }

  waitForFirebase(async () => {
    const { db } = window._firebase;
    try {
      const snap = await db.collection("promos").doc(code).get();
      if (!snap.exists) {
        const refSnap = await db.collection("users").where("referralCode","==",code).get();
        if (!refSnap.empty && currentUser) {
          const refUser = refSnap.docs[0].data();
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

function updatePriceDisplay() {
  const priceEl   = document.getElementById("livePrice");
  const advanceEl = document.getElementById("advanceAmount");
  const discRow   = document.getElementById("discountRow");
  const discAmt   = document.getElementById("discountAmt");
  const optAdv    = document.getElementById("optAdvanceAmt");
  const optFull   = document.getElementById("optFullAmt");
  if (!priceEl) return;

  const discounted = Math.max(lastCalculatedTotal - promoDiscount, 0);
  const fullDiscount = Math.round(discounted * 0.05);
  const fullAmount = discounted - fullDiscount;

  const optAtDrop = document.getElementById("optAtDropAmt");
  priceEl.innerText   = "₹" + discounted.toLocaleString();
  advanceEl.innerText = "₹" + Math.round(discounted * 0.10).toLocaleString();
  if (optAdv)    optAdv.textContent    = "₹" + Math.round(discounted * 0.10).toLocaleString();
  if (optFull)   optFull.textContent   = "₹" + fullAmount.toLocaleString();
  if (optAtDrop) optAtDrop.textContent = "₹" + discounted.toLocaleString();

  if (promoDiscount > 0 && discRow) {
    discRow.style.display = "block";
    if (discAmt) discAmt.textContent = "₹" + promoDiscount.toLocaleString();
  }
}

/* ============================================
   PAYMENT OPTIONS
   ============================================ */
function selectPayment(type) {
  selectedPayment = type;
  document.getElementById("optAdvance").classList.toggle("selected", type === "advance");
  document.getElementById("optFull").classList.toggle("selected", type === "full");
  document.getElementById("optAtDrop")?.classList.toggle("selected", type === "at_drop");
  const payBtn = document.querySelector(".btn-pay");
  if (payBtn) {
    if (type === "advance")  payBtn.textContent = "💳 Pay Advance & Confirm";
    if (type === "full")     payBtn.textContent = "💳 Pay Full & Confirm";
    if (type === "at_drop")  payBtn.textContent = "📋 Book Now — Pay at Drop";
  }
}

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
  } catch (e) { console.error("Quote save error:", e); }
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
      if (!navigator.geolocation) { alert("Location not supported."); toggle.checked = false; return; }
      pickupInput.value = "📍 Getting your location...";
      navigator.geolocation.getCurrentPosition(
        pos => {
          const latLng = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
          new google.maps.Geocoder().geocode({ location: latLng }, (res, status) => {
            if (status === "OK" && res[0]) {
              pickupInput.value = res[0].formatted_address;
              pickupPlace = { geometry: { location: latLng } };
              showLocation("pickup"); calculateQuote(true);
            } else { pickupInput.value = ""; toggle.checked = false; alert("Could not get address. Type manually."); }
          });
        },
        err => { pickupInput.value = ""; toggle.checked = false; alert("Location error: " + err.message); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
  attachAutoCalculation();
}

function attachAutoCalculation() {
  ["house","vehicle","sofaCheck","sofaQty","bedCheck","bedQty","fridgeCheck","wmCheck"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => calculateQuote(true));
  });
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
/* ============================================
   PRICE CALCULATION — BANGALORE LOCAL ONLY
   Vehicle + distance pricing.
   ============================================ */
function calculateQuote(auto = false) {
  const pickup  = document.getElementById("pickup");
  const drop    = document.getElementById("drop");
  const vehicle = document.getElementById("vehicle");
  const result  = document.getElementById("result");

  if (!pickup?.value || !drop?.value) { if (!auto) alert("Enter pickup & drop locations"); return; }
  if (!vehicle?.value)                { if (!auto) alert("Select a vehicle type");         return; }

  // Furniture add-ons
  let furnitureCost = 0;
  if (document.getElementById("sofaCheck")?.checked)     furnitureCost += 2000 * Number(document.getElementById("sofaQty")?.value  || 1);
  if (document.getElementById("bedCheck")?.checked)      furnitureCost += 1600 * Number(document.getElementById("bedQty")?.value   || 1);
  if (document.getElementById("fridgeCheck")?.checked)   furnitureCost += FRIDGE_PRICE;
  if (document.getElementById("wmCheck")?.checked)       furnitureCost += 1200;
  if (document.getElementById("tvCheck")?.checked)       furnitureCost += 800;
  if (document.getElementById("acCheck")?.checked)       furnitureCost += 1700;
  if (document.getElementById("wardrobeCheck")?.checked) furnitureCost += 1750;
  if (document.getElementById("diningCheck")?.checked)   furnitureCost += 1200;
  // Office items
  if (document.getElementById("deskCheck")?.checked)     furnitureCost += 900  * Number(document.getElementById("deskQty")?.value  || 1);
  if (document.getElementById("chairCheck")?.checked)    furnitureCost += 350  * Number(document.getElementById("chairQty")?.value || 1);
  if (document.getElementById("cabinetCheck")?.checked)  furnitureCost += 750;
  if (document.getElementById("serverCheck")?.checked)   furnitureCost += 1250;
  if (document.getElementById("printerCheck")?.checked)  furnitureCost += 600;
  if (document.getElementById("confCheck")?.checked)     furnitureCost += 1750;

  // Floor & packing costs
  const pickupFloor = Number(document.getElementById("pickupFloor")?.value || 0);
  const dropFloor   = Number(document.getElementById("dropFloor")?.value   || 0);
  const liftAvail   = document.getElementById("liftAvailable")?.checked;
  const floorCost   = liftAvail
    ? (pickupFloor + dropFloor) * 100
    : (pickupFloor + dropFloor) * 200;
  const packingCost = document.getElementById("packingService")?.checked ? 3800 : 0;

  function applyPrice(km) {
    const vehicleVal = Number(vehicle.value || 0);

    let baseFare, perKmRate;
    if      (vehicleVal >= 8000) { baseFare = 9000; perKmRate = 40; }  // 19ft
    else if (vehicleVal >= 5000) { baseFare = 6500; perKmRate = 35; }  // 14ft
    else                         { baseFare = 3999; perKmRate = 25; }  // Tata Ace / small

    const distanceFare = km <= 25 ? baseFare : baseFare + ((km - 25) * perKmRate);
    const total = Math.round(distanceFare + furnitureCost + floorCost + packingCost);

    const breakdownHtml =
      `📍 Bangalore Local · ~${km.toFixed(1)} km<br>` +
      `Base fare: ₹${baseFare.toLocaleString()}` +
      `${km > 25       ? ` · Extra km: ₹${Math.round((km-25)*perKmRate).toLocaleString()}` : ""}` +
      `${furnitureCost ? ` · Items: ₹${furnitureCost.toLocaleString()}`                    : ""}` +
      `${floorCost     ? ` · Floor: ₹${floorCost.toLocaleString()}`                        : ""}` +
      `${packingCost   ? ` · Packing: ₹${packingCost.toLocaleString()}`                    : ""}` +
      `<br><strong>Total Estimate: ₹${total.toLocaleString()}</strong>`;

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
      if (status === "OK" && el?.status === "OK" && el.distance?.value) {
        applyPrice(el.distance.value / 1000);
      } else {
        if (pickupPlace?.geometry && dropPlace?.geometry) {
          const R = 6371;
          const p1 = pickupPlace.geometry.location, p2 = dropPlace.geometry.location;
          const lat1 = p1.lat() * Math.PI / 180, lat2 = p2.lat() * Math.PI / 180;
          const dLat = lat2 - lat1, dLng = (p2.lng() - p1.lng()) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
          applyPrice(Math.max(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3, 5));
        } else {
          applyPrice(15);
        }
      }
    });
  } catch(e) { console.error("Distance error:", e); applyPrice(15); }
}
