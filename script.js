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
let selectedPayment     = "advance"; // "advance" | "full"
let currentRating       = 0;
let trackingListener    = null;
let chatListener        = null;
let trackingMap         = null;
let trackingDriverMarker = null;
let currentBookingId    = null;
let uploadedPhotos      = []; // base64 strings

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE   = 400;
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

  // Scroll Reveal
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); revealObs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal, .reveal-stagger").forEach(el => revealObs.observe(el));

  // Stats counter
  function animateCounter(el) {
    const target = parseInt(el.dataset.target), dur = 2000, start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(tick);
  }
  const statsObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.querySelectorAll(".stat-number").forEach(animateCounter); statsObs.unobserve(e.target); } });
  }, { threshold: 0.3 });
  const strip = document.getElementById("statsStrip");
  if (strip) statsObs.observe(strip);

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
    });
  });

  // Load reviews on page load
  loadReviewsPublic();
  buildChecklist();
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

  // Always hide admin link first (reset state on logout)
  if (adminLink) adminLink.style.display = "none";

  if (user) {
    loginBtn.style.display = "none";
    navUser.style.display  = "flex";
    const name = user.displayName || user.email?.split("@")[0] || "User";
    navName.textContent   = name.split(" ")[0];
    navAvatar.textContent = name.charAt(0).toUpperCase();

    // ✅ Check Firestore for admin role and show Admin Panel link
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

function toggleUserMenu() { document.getElementById("userDropdown").classList.toggle("open"); }

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

    // Reset recaptcha every time to avoid stale verifier errors
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch(e) {}
      window.recaptchaVerifier = null;
    }

    // Fix: Only 2 arguments for RecaptchaVerifier (Firebase v8 compat)
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
          // Reset recaptcha so user can try again
          try { window.recaptchaVerifier.clear(); } catch(e) {}
          window.recaptchaVerifier = null;
          // Show real error message
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
    // Process referral if provided
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
  const existing = document.getElementById("toastMsg");
  if (existing) existing.remove();
  const t = document.createElement("div");
  t.id = "toastMsg"; t.className = "toast-msg"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, dur);
}

/* ============================================
   DASHBOARD
   ============================================ */
async function openDashboard() {
  document.getElementById("userDropdown").classList.remove("open");

  if (!currentUser) {
    openAuthModal("login");
    return;
  }

  const { db } = window._firebase;

  const userSnap = await db.collection("users")
    .doc(currentUser.uid)
    .get();

  const userData = userSnap.data();

  const name = currentUser.displayName || "User";

  document.getElementById("dashName").textContent = name;
  document.getElementById("dashEmail").textContent = currentUser.email || "";
  document.getElementById("dashAvatar").textContent = name.charAt(0).toUpperCase();

  // 🔥 ADMIN CHECK
  if (userData.role === "admin") {

    if (!document.getElementById("adminTabBtn")) {

      const tabContainer = document.querySelector(".dash-tabs");

      const btn = document.createElement("button");
      btn.className = "dash-tab";
      btn.id = "adminTabBtn";
      btn.innerText = "🛠 Admin";
      btn.onclick = function() {
        switchDashTab("admin", btn);
      };

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
      // Check promos collection
      const snap = await db.collection("promos").doc(code).get();
      if (!snap.exists) {
        // Also check referral codes
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
      promoDiscount = Math.min(discount, lastCalculatedTotal * 0.5); // max 50% off
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
  // Update pay button label
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
  if (!pickup?.value || !drop?.value)        { if (!auto) alert("Enter pickup & drop");    return; }
  const houseBase   = Number(house?.value   || 0);
  const vehicleRate = Number(vehicle?.value || 0);
  if (!houseBase || !vehicleRate)            { if (!auto) alert("Select house & vehicle"); return; }

  let furnitureCost = 0;
  if (document.getElementById("sofaCheck")?.checked)   furnitureCost += 500 * Number(document.getElementById("sofaQty")?.value || 1);
  if (document.getElementById("bedCheck")?.checked)    furnitureCost += 700 * Number(document.getElementById("bedQty")?.value  || 1);
  if (document.getElementById("fridgeCheck")?.checked) furnitureCost += FRIDGE_PRICE;
  if (document.getElementById("wmCheck")?.checked)     furnitureCost += 400;

  function applyPrice(km) {
    const total = Math.round(MIN_BASE_PRICE + houseBase + (km * vehicleRate) + furnitureCost);
    if (result) result.innerHTML = `Distance: ~${km.toFixed(1)} km &nbsp;|&nbsp; Furniture: ₹${furnitureCost}<br><strong>Total Estimate: ₹${total.toLocaleString()}</strong>`;
    lastCalculatedTotal = total;
    updatePriceDisplay();
    if (currentUser) saveQuoteToFirestore(total);
  }

  try {
    new google.maps.DistanceMatrixService().getDistanceMatrix({
      origins: [pickup.value], destinations: [drop.value], travelMode: "DRIVING"
    }, (res, status) => {
      const el = res && res.rows && res.rows[0] && res.rows[0].elements && res.rows[0].elements[0];
      if (status === "OK" && el && el.status === "OK" && el.distance && el.distance.value) {
        applyPrice(el.distance.value / 1000);
      } else {
        console.warn("DistanceMatrix failed:", status, el ? el.status : "no element");
        if (pickupPlace && pickupPlace.geometry && dropPlace && dropPlace.geometry) {
          const R = 6371;
          const p1 = pickupPlace.geometry.location;
          const p2 = dropPlace.geometry.location;
          const lat1 = p1.lat() * Math.PI / 180, lat2 = p2.lat() * Math.PI / 180;
          const dLat = lat2 - lat1;
          const dLng = (p2.lng() - p1.lng()) * Math.PI / 180;
          const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)*Math.sin(dLng/2);
          const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3;
          applyPrice(Math.max(km, 5));
        } else {
          applyPrice(15);
        }
      }
    });
  } catch(e) {
    console.error("DistanceMatrix error:", e);
    applyPrice(15);
  }
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
  const name  = document.getElementById("custName")?.value?.trim();
  const phone = document.getElementById("custPhone")?.value?.trim();
  if (!name)                       return alert("Please enter your name.");
  if (!phone || phone.length < 10) return alert("Please enter a valid phone number.");
  if (lastCalculatedTotal === 0)   return alert("Price not calculated yet.");

  saveLead();
  const pickup     = document.getElementById("pickup")?.value  || "";
  const drop       = document.getElementById("drop")?.value    || "";
  const date       = document.getElementById("shiftDate")?.value || "";
  const house      = document.getElementById("house");
  const vehicle    = document.getElementById("vehicle");
  const houseText  = house?.options[house?.selectedIndex]?.text    || "";
  const vehicleText= vehicle?.options[vehicle?.selectedIndex]?.text || "";
  const bookingRef = "WA-" + Date.now().toString(36).toUpperCase();

  // 1. Save to Firestore FIRST, then open WhatsApp
  if (window._firebase) {
    try {
      showToast("⏳ Saving booking...");
      const docRef = await window._firebase.db.collection("bookings").add({
        bookingRef,
        customerUid:  currentUser?.uid || null,
        customerName: name, phone, pickup, drop, date,
        house: houseText, vehicle: vehicleText,
        total:        lastCalculatedTotal,
        paid:         0,
        status:       "confirmed",
        source:       "whatsapp",
        promoDiscount,
        createdAt:    firebase.firestore.FieldValue.serverTimestamp()
      });
      currentBookingId = docRef.id;

      // 2. Show confirmation popup
      const subEl  = document.getElementById("paymentModalSub");
      const idBox  = document.getElementById("bookingIdBox");
      const idDisp = document.getElementById("bookingIdDisplay");
      const invBtn = document.getElementById("btnInvoice");
      document.getElementById("modalDetail").innerHTML =
        `<strong>Booking ID:</strong> ${bookingRef}<br>` +
        `<strong>Name:</strong> ${name}<br>` +
        `<strong>Phone:</strong> ${phone}<br>` +
        `<strong>Pickup:</strong> ${pickup||"—"}<br>` +
        `<strong>Drop:</strong> ${drop||"—"}<br>` +
        `<strong>Date:</strong> ${date||"TBD"}<br>` +
        `<strong>House Type:</strong> ${houseText||"—"}<br>` +
        `<strong>Vehicle:</strong> ${vehicleText||"—"}<br>` +
        `<strong>Total Estimate:</strong> ₹${lastCalculatedTotal.toLocaleString()}<br>` +
        `<strong>Payment:</strong> Cash on moving day`;
      if (subEl)  subEl.textContent = "Booking confirmed! Your ID is ready — send it to our WhatsApp.";
      if (idBox)  idBox.style.display = "block";
      if (idDisp) idDisp.textContent = bookingRef;
      if (invBtn) invBtn.style.display = "none";
      document.getElementById("paymentModal").style.display = "flex";

      // 3. Open WhatsApp with full details + booking ID
      const msg =
        "✅ *New Booking — PackZen*\n" +
        "━━━━━━━━━━━━━━━━━━━━\n" +
        `🔖 *Booking ID:* ${bookingRef}\n` +
        `👤 *Name:* ${name}\n` +
        `📞 *Phone:* ${phone}\n` +
        `📍 *Pickup:* ${pickup}\n` +
        `🏁 *Drop:* ${drop}\n` +
        `📅 *Date:* ${date||"TBD"}\n` +
        `🏠 *House:* ${houseText||"—"}\n` +
        `🚚 *Vehicle:* ${vehicleText||"—"}\n` +
        `💰 *Estimate:* ₹${lastCalculatedTotal.toLocaleString()}\n` +
        "━━━━━━━━━━━━━━━━━━━━\n" +
        "Payment: Cash on moving day";
      window.open(`https://wa.me/919945095453?text=${encodeURIComponent(msg)}`, "_blank");

    } catch(e) {
      console.error("WA booking save:", e);
      alert("Booking save failed: " + e.message);
    }
  } else {
    alert("Service not ready. Please refresh and try again.");
  }
}

/* ============================================
   RAZORPAY PAYMENT
   ============================================ */
function startPayment() {
  const name  = document.getElementById("custName")?.value?.trim();
  const phone = document.getElementById("custPhone")?.value?.trim();
  if (!name)  return alert("Please enter your name.");
  if (!phone || phone.length < 10) return alert("Please enter a valid phone number.");
  if (lastCalculatedTotal === 0)   return alert("Price not calculated yet.");

  if (RAZORPAY_KEY === "YOUR_RAZORPAY_KEY_ID") {
    alert("⚠️ Razorpay not activated yet.\n\nUse 'Book via WhatsApp Only' for now.");
    return;
  }

  const discounted = Math.max(lastCalculatedTotal - promoDiscount, 0);

  // Pay at Drop — save booking and confirm, no online payment now
  if (selectedPayment === "at_drop") {
    bookWithoutPayment("at_drop");
    return;
  }

  let payAmount;
  if (selectedPayment === "full") {
    payAmount = Math.round(discounted * 0.95); // 5% discount for full payment
  } else {
    payAmount = Math.round(discounted * 0.10); // 10% advance
  }
  paymentReceiptId = "PKZ-" + Date.now();

  const rzp = new Razorpay({
    key: RAZORPAY_KEY, amount: payAmount * 100, currency: "INR",
    name: "PackZen Packers & Movers",
    description: selectedPayment === "full" ? `Full Payment (5% off applied)` : `Advance 10% of ₹${discounted.toLocaleString()}`,
    receipt: paymentReceiptId,
    prefill: { name, contact: phone },
    theme: { color: "#0057ff" },
    handler: (response) => onPaymentSuccess(response, name, phone, payAmount, discounted),
    modal: { ondismiss: () => {} }
  });
  rzp.open();
  rzp.on("payment.failed", r => alert("Payment failed: " + r.error.description));
}

function onPaymentSuccess(response, name, phone, paid, total) {
  const pickup = document.getElementById("pickup");
  const drop   = document.getElementById("drop");
  const shiftDate = document.getElementById("shiftDate");

  const bookingRef = "PKZ-" + Date.now().toString(36).toUpperCase();
  document.getElementById("modalDetail").innerHTML = `
    <strong>Booking ID:</strong> ${bookingRef}<br>
    <strong>Name:</strong> ${name}<br>
    <strong>Phone:</strong> ${phone}<br>
    <strong>Pickup:</strong> ${pickup?.value||"-"}<br>
    <strong>Drop:</strong> ${drop?.value||"-"}<br>
    <strong>Total Estimate:</strong> ₹${total.toLocaleString()}<br>
    <strong>Amount Paid:</strong> ₹${paid.toLocaleString()} (${selectedPayment === "full" ? "Full" : "Advance"})<br>
    <strong>Payment ID:</strong> ${response.razorpay_payment_id}`;
  const subEl = document.getElementById("paymentModalSub");
  if (subEl) subEl.textContent = "Payment successful! Save your Booking ID for tracking.";
  const idBox = document.getElementById("bookingIdBox");
  const idDisp = document.getElementById("bookingIdDisplay");
  if (idBox) idBox.style.display = "block";
  if (idDisp) idDisp.textContent = bookingRef;
  const invoiceBtn = document.getElementById("btnInvoice");
  if (invoiceBtn) invoiceBtn.style.display = "block";
  document.getElementById("paymentModal").style.display = "flex";

  // Save booking to Firestore
  if (window._firebase) {
    window._firebase.db.collection("bookings").add({
      customerUid:  currentUser?.uid || null,
      customerName: name, phone,
      pickup: pickup?.value||"", drop: drop?.value||"",
      total, paid, paymentType: selectedPayment,
      promoDiscount, date: shiftDate?.value||"",
      status: "confirmed",
      paymentId: response.razorpay_payment_id,
      photos: uploadedPhotos.slice(0,3),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(docRef => { currentBookingId = docRef.id; })
    .catch(e => console.error("Booking save:", e));
  }
}

function downloadInvoice() {
  const detail = document.getElementById("modalDetail")?.innerText || "";
  if (typeof jspdf === "undefined" && typeof window.jspdf === "undefined") {
    showToast("⚠️ PDF library loading... try again in a moment.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const now = new Date();

  doc.setFillColor(0, 87, 255); doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont("helvetica","bold");
  doc.text("📦 PackZen Packers & Movers", 14, 15);
  doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text("GST Invoice", 14, 22);

  doc.setTextColor(0,0,0); doc.setFontSize(11);
  doc.text("Invoice No: " + paymentReceiptId, 14, 42);
  doc.text("Date: " + now.toLocaleDateString("en-IN"), 14, 50);
  doc.text("GSTIN: 29XXXXX1234Z1 (Add yours)", 14, 58);

  doc.setFillColor(240, 247, 255); doc.rect(14, 65, 182, 8, "F");
  doc.setFont("helvetica","bold"); doc.text("Booking Details", 16, 71);
  doc.setFont("helvetica","normal");

  const lines = detail.split("\n").filter(l => l.trim());
  let y = 82;
  lines.forEach(line => {
    doc.text(line.replace(/\s+/g, " "), 14, y);
    y += 8;
  });

  y += 4;
  doc.setFillColor(0, 87, 255); doc.setTextColor(255,255,255);
  doc.rect(14, y, 182, 10, "F");
  doc.setFont("helvetica","bold");
  doc.text("Total includes 18% GST as applicable", 16, y + 7);

  doc.setTextColor(100,100,100); doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text("PackZen Packers & Movers | HSR Layout, Bangalore | Ph: 9945095453 | packzen.com", 14, 285);

  doc.save("PackZen-Invoice-" + paymentReceiptId + ".pdf");
}

function sendWhatsAppAfterPayment() {
  const pickup = document.getElementById("pickup");
  const drop   = document.getElementById("drop");
  const msg = `✅ Booking Confirmed — PackZen\n\nPickup: ${pickup?.value}\nDrop: ${drop?.value}\nTotal: ₹${lastCalculatedTotal.toLocaleString()}\nReceipt: ${paymentReceiptId}`;
  window.open(`https://wa.me/919945095453?text=${encodeURIComponent(msg)}`, "_blank");
}

function closeModal() { document.getElementById("paymentModal").style.display = "none"; }

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
    .where("customerUid","==",currentUser.uid)
    .orderBy("createdAt","desc").limit(1)
    .onSnapshot(snap => {
      if (snap.empty) { document.getElementById("trackingBookingId").textContent = "No active booking"; return; }
      const booking = { id: snap.docs[0].id, ...snap.docs[0].data() };
      currentBookingId = booking.id;
      updateTrackingUI(booking);
    });
}

function updateTrackingUI(b) {
  document.getElementById("trackingBookingId").textContent = "#" + b.id.slice(-6).toUpperCase();
  document.getElementById("trackStatus").textContent     = capitalize(b.status||"confirmed");
  document.getElementById("trackDriver").textContent     = b.driverName   || "Not yet assigned";
  document.getElementById("trackDriverPhone").textContent = b.driverPhone  || "—";
  document.getElementById("trackDate").textContent       = b.date          || "—";
  document.getElementById("trackPickup").textContent     = b.pickup        || "—";
  document.getElementById("trackDrop").textContent       = b.drop          || "—";

  // Update step dots
  const order = ["confirmed","assigned","packing","transit","delivered"];
  const idx = order.indexOf(b.status||"confirmed");
  const icons = ["✓","🚛","📦","🚚","🎉"];
  order.forEach((s, i) => {
    const dot = document.getElementById("ts" + i);
    if (!dot) return;
    dot.className = "ts-dot";
    if (i < idx)  { dot.classList.add("done"); dot.textContent = "✓"; }
    if (i === idx) { dot.classList.add("active"); dot.textContent = icons[i]; }
    if (i > idx)   dot.textContent = icons[i];
  });

  // Map
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
  } else {
    mapDiv.innerHTML = `<span>📍 Driver at ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`;
  }
}

/* ============================================
   CHAT MODAL
   ============================================ */
function openChatModal() {
  document.getElementById("userDropdown")?.classList.remove("open");
  if (!currentUser) { openAuthModal("login"); return; }
  document.getElementById("chatModal").style.display = "flex";
  loadChatMessages();
}

function closeChatModal() {
  document.getElementById("chatModal").style.display = "none";
  if (chatListener) { chatListener(); chatListener = null; }
}

function loadChatMessages() {
  if (!window._firebase || !currentBookingId) {
    // Try to find current booking
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
        const msg = d.data();
        const isMine = msg.senderUid === currentUser?.uid;
        const time = msg.time?.toDate ? msg.time.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "";
        container.innerHTML += `<div class="chat-bubble ${isMine?"mine":"theirs"}"><div>${msg.text}</div><div class="chat-time">${time}</div></div>`;
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
    "Notify your landlord / society",
    "Contact PackZen for booking confirmation",
    "Start collecting packing boxes",
    "Sort items — keep, donate, discard",
    "Update your address with bank & insurance"
  ],
  "1 Week Before": [
    "Start packing non-essential items",
    "Label all boxes by room",
    "Pack fragile items with extra padding",
    "Defrost refrigerator",
    "Arrange for parking at both locations"
  ],
  "Moving Day": [
    "Check all rooms before leaving",
    "Ensure utilities are transferred",
    "Take photos of all packed items",
    "Keep essentials bag with you",
    "Verify all boxes are loaded",
    "Do a final walkthrough of old home"
  ],
  "After Moving": [
    "Unpack essentials first",
    "Check all items for damage",
    "Update Aadhaar address",
    "Connect utilities at new home",
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
      const key = cat + i;
      const done = saved[key];
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
  if (el.classList.contains("done")) check.textContent = "✓";
  else check.textContent = "";
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
function openReviewModal() { document.getElementById("reviewModal").style.display = "flex"; currentRating = 0; }
function closeReviewModal() { document.getElementById("reviewModal").style.display = "none"; }

function setRating(n) {
  currentRating = n;
  document.querySelectorAll(".star-btn").forEach((btn, i) => {
    btn.classList.toggle("lit", i < n);
  });
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
        uid:     currentUser?.uid  || null,
        email:   currentUser?.email || null,
        status:  "approved",
        date:    new Date().toLocaleDateString("en-IN"),
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
      const grid = document.getElementById("reviewsGrid");
      const countEl = document.getElementById("reviewCountLabel");
      if (countEl) countEl.textContent = `Based on ${snap.size}+ reviews`;
      let html = "";
      snap.forEach(d => {
        const r = d.data();
        html += `<div class="review-card"><div class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</div><p class="review-text">"${r.text}"</p><div class="review-author"><div class="review-avatar">${r.name.charAt(0).toUpperCase()}</div><div><div class="review-name">${r.name}</div><div class="review-meta">${r.date||""}</div></div></div></div>`;
      });
      if (grid) grid.innerHTML = html;
    } catch (e) { console.log("Reviews load:", e.message); }
  });
}

/* ============================================
   MULTI-STEP FORM
   ============================================ */
let currentStep = 0;
const steps     = document.querySelectorAll(".form-step");

function updateStepDots(n) {
  document.querySelectorAll(".step-dot").forEach((dot, i) => {
    dot.classList.remove("active","done");
    if (i < n) dot.classList.add("done");
    if (i === n) dot.classList.add("active");
  });
  document.querySelectorAll(".step-line").forEach((line, i) => line.classList.toggle("done", i < n));
}

function showStep(n) {
  steps.forEach(s => s.classList.remove("active"));
  steps[n].classList.add("active");
  steps[n].style.animation = "none";
  void steps[n].offsetWidth;
  steps[n].style.animation = "";
  const pb = document.getElementById("progressBar");
  if (pb) pb.style.width = ((n + 1) / steps.length) * 100 + "%";
  updateStepDots(n);
  if (n === steps.length - 1) {
    calculateQuote(true);
    autoFillCustomerDetails();
  }
}

function autoFillCustomerDetails() {
  if (!currentUser || !window._firebase) return;
  const nameEl  = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  // Only fill if fields are empty (don't overwrite what user typed)
  window._firebase.db.collection("users").doc(currentUser.uid).get()
    .then(doc => {
      if (!doc.exists) return;
      const d = doc.data();
      if (nameEl  && !nameEl.value.trim())  nameEl.value  = d.name  || currentUser.displayName || "";
      if (phoneEl && !phoneEl.value.trim()) phoneEl.value = d.phone || "";
    })
    .catch(() => {
      // Fallback to auth profile
      if (nameEl  && !nameEl.value.trim())  nameEl.value  = currentUser.displayName || "";
    });
}

function nextStep() {
  const pickup  = document.getElementById("pickup");
  const drop    = document.getElementById("drop");
  const house   = document.getElementById("house");
  const vehicle = document.getElementById("vehicle");
  if (currentStep === 0 && (!pickup?.value || !drop?.value))   return alert("Enter pickup & drop locations.");
  if (currentStep === 1 && (!house?.value  || !vehicle?.value)) return alert("Select house type & vehicle.");
  if (currentStep < steps.length - 1) { currentStep++; showStep(currentStep); }
}

function prevStep() {
  if (currentStep > 0) { currentStep--; showStep(currentStep); }
}

/* ============================================
   HELPERS
   ============================================ */
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
/* ============================================
   ADMIN PANEL (Secure Driver Creation)
   ============================================ */
async function createDriver() {
  if (!currentUser) {
    showToast("⚠️ Please login as admin.");
    return;
  }

  const name = document.getElementById("newDriverName").value.trim();
  const email = document.getElementById("newDriverEmail").value.trim();
  const password = document.getElementById("newDriverPassword").value.trim();
  const msg = document.getElementById("adminMsg");

  msg.style.color = "#e53e3e";
  msg.innerText = "";

  if (!name || !email || !password) {
    msg.innerText = "All fields are required.";
    return;
  }

  if (password.length < 6) {
    msg.innerText = "Password must be at least 6 characters.";
    return;
  }

  try {
    const { auth, db } = window._firebase;

    // Create driver account
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const driverUser = cred.user;

    // Create Firestore document
    await db.collection("users").doc(driverUser.uid).set({
      name: name,
      email: email,
      role: "driver",
      isOnline: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Call secure Cloud Function to assign driver claim
    const functions = firebase.app().functions("us-central1");
    const assignDriverRole = functions.httpsCallable("assignDriverRole");

    await assignDriverRole({ uid: driverUser.uid });

    msg.style.color = "#00a357";
    msg.innerText = "✅ Driver created successfully.";

    // Clear fields
    document.getElementById("newDriverName").value = "";
    document.getElementById("newDriverEmail").value = "";
    document.getElementById("newDriverPassword").value = "";

    // IMPORTANT: Re-login admin
    await auth.signOut();
    alert("Driver created successfully.\nPlease login again as admin.");
    window.location.reload();

  } catch (error) {
    console.error("Driver creation error:", error);
    msg.style.color = "#e53e3e";
    msg.innerText = error.message || "Failed to create driver.";
  }
}


/* ============================================
   BOOK WITHOUT PAYMENT
   ============================================ */
function bookWithoutPayment() {
  // Validate name & phone — highlight fields if empty
  const nameEl  = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  const name    = nameEl?.value?.trim();
  const phone   = phoneEl?.value?.trim();

  if (!name) {
    nameEl.style.borderColor = "#e53e3e";
    nameEl.focus();
    nameEl.placeholder = "⚠️ Please enter your name";
    nameEl.addEventListener("input", () => { nameEl.style.borderColor = ""; }, { once: true });
    return;
  }
  if (!phone || phone.length < 10) {
    phoneEl.style.borderColor = "#e53e3e";
    phoneEl.focus();
    phoneEl.placeholder = "⚠️ Please enter valid 10-digit number";
    phoneEl.addEventListener("input", () => { phoneEl.style.borderColor = ""; }, { once: true });
    return;
  }
  if (lastCalculatedTotal === 0) {
    showToast("⚠️ Price not calculated yet. Please enter pickup & drop locations.");
    return;
  }

  const pickup     = document.getElementById("pickup")?.value    || "";
  const drop       = document.getElementById("drop")?.value      || "";
  const date       = document.getElementById("shiftDate")?.value || "";
  const bookingRef = "PKZ-" + Date.now().toString(36).toUpperCase().slice(-6);

  if (!window._firebase) { showToast("⚠️ Service not ready. Try again."); return; }

  // Disable button to prevent double-click
  const btn = document.querySelector(".btn-free-book");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Saving..."; }

  window._firebase.db.collection("bookings").add({
    bookingRef,
    customerUid:  currentUser?.uid || null,
    customerName: name,
    phone,
    pickup,
    drop,
    date,
    total:        lastCalculatedTotal,
    paid:         0,
    paymentType:  "pay_later",
    status:       "confirmed",
    source:       "direct",
    promoDiscount,
    photos:       uploadedPhotos.slice(0, 3),
    createdAt:    firebase.firestore.FieldValue.serverTimestamp()
  }).then(docRef => {
    currentBookingId = docRef.id;
    if (btn) { btn.disabled = false; btn.textContent = "📋 Book Now (Pay Later)"; }

    // Build confirmation detail
    const detail =
      `<strong>Booking ID:</strong> ${bookingRef}<br>` +
      `<strong>Name:</strong> ${name}<br>` +
      `<strong>Phone:</strong> +91 ${phone}<br>` +
      `<strong>Pickup:</strong> ${pickup||"—"}<br>` +
      `<strong>Drop:</strong> ${drop||"—"}<br>` +
      `<strong>Date:</strong> ${date||"—"}<br>` +
      `<strong>Total Estimate:</strong> ₹${lastCalculatedTotal.toLocaleString()}<br>` +
      `<strong>Payment:</strong> Pay on moving day`;

    // Show popup
    const subEl  = document.getElementById("paymentModalSub");
    const idBox  = document.getElementById("bookingIdBox");
    const idDisp = document.getElementById("bookingIdDisplay");
    const invBtn = document.getElementById("btnInvoice");
    document.getElementById("modalDetail").innerHTML = detail;
    if (subEl)  subEl.textContent = "Booking confirmed! 🎉 Your ID is below — screenshot or copy it.";
    if (idBox)  idBox.style.display = "block";
    if (idDisp) idDisp.textContent = bookingRef;
    if (invBtn) invBtn.style.display = "none";
    document.getElementById("paymentModal").style.display = "flex";

    // Auto-send WhatsApp to CUSTOMER (no confirm prompt)
    const customerMsg =
      `✅ *Booking Confirmed — PackZen* 🚚\n\n` +
      `📌 *Booking ID:* ${bookingRef}\n` +
      `👤 *Name:* ${name}\n` +
      `📍 *Pickup:* ${pickup}\n` +
      `🏁 *Drop:* ${drop}\n` +
      `📅 *Date:* ${date||"To be confirmed"}\n` +
      `💰 *Estimate:* ₹${lastCalculatedTotal.toLocaleString()}\n` +
      `💳 *Payment:* Pay on moving day\n\n` +
      `Our team will call you shortly to confirm. Save this Booking ID for tracking!\n\n` +
      `— PackZen Packers & Movers | 📞 9945095453`;
    setTimeout(() => {
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(customerMsg)}`, "_blank");
    }, 800);

    // Also notify admin on WhatsApp
    const adminMsg =
      `🔔 *New Booking (Pay Later)* — PackZen\n\n` +
      `📌 ID: ${bookingRef}\n` +
      `👤 ${name} | 📞 ${phone}\n` +
      `📍 ${pickup} → ${drop}\n` +
      `📅 Date: ${date||"—"}\n` +
      `💰 Estimate: ₹${lastCalculatedTotal.toLocaleString()}`;
    setTimeout(() => {
      window.open(`https://wa.me/919945095453?text=${encodeURIComponent(adminMsg)}`, "_blank");
    }, 1200);

    showToast("✅ Booking saved! ID: " + bookingRef);

  }).catch(e => {
    if (btn) { btn.disabled = false; btn.textContent = "📋 Book Now (Pay Later)"; }
    showToast("❌ Booking failed: " + e.message);
    console.error("bookWithoutPayment error:", e);
  });
}

function copyBookingId() {
  const id = document.getElementById("bookingIdDisplay")?.textContent;
  if (!id || id === "—") return;
  navigator.clipboard.writeText(id).then(() => showToast("✅ Booking ID copied!"));
}

/* ============================================
   DASHBOARD — MISSING FUNCTIONS
   ============================================ */
function closeDashboard() {
  document.getElementById("dashboardModal").style.display = "none";
}

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
  window._firebase.db.collection("quotes")
    .where("uid","==",currentUser.uid)
    .orderBy("createdAt","desc").limit(10).get()
    .then(snap => {
      const list = document.getElementById("quotesList");
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<div class="dash-empty">No saved quotes yet.</div>'; return; }
      list.innerHTML = snap.docs.map(d => {
        const q = d.data();
        return `<div class="quote-item">
          <div class="qi-route">📍 ${q.pickup||"?"} → 🏁 ${q.drop||"?"}</div>
          <div class="qi-details"><span>${q.house||"—"}</span><span>${q.vehicle||"—"}</span><span class="qi-price">₹${(q.total||0).toLocaleString()}</span></div>
          <div class="qi-date">${q.date||""}</div>
        </div>`;
      }).join("");
    }).catch(e => console.error("Quotes load:", e));
}

function loadUserBookings() {
  if (!currentUser || !window._firebase) return;
  window._firebase.db.collection("bookings")
    .where("customerUid","==",currentUser.uid)
    .orderBy("createdAt","desc").limit(10).get()
    .then(snap => {
      const list = document.getElementById("bookingsList");
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<div class="dash-empty">No bookings yet.</div>'; return; }
      const statusColors = { confirmed:"#0057ff", assigned:"#7c3aed", packing:"#0ea5e9", transit:"#f97316", delivered:"#00c96e", pending:"#d97706" };
      list.innerHTML = snap.docs.map(d => {
        const b = d.data();
        const color = statusColors[b.status] || "#5a6a8a";
        const src = b.source === "whatsapp" ? "💬 " : b.paymentType === "pay_later" ? "📋 " : "💳 ";
        return `<div class="quote-item">
          <div class="qi-route">${src}${(b.pickup||"?").split(",")[0]} → ${(b.drop||"?").split(",")[0]}</div>
          <div class="qi-details">
            <span class="qi-price">₹${(b.total||0).toLocaleString()}</span>
            <span class="qi-status" style="color:${color}">● ${capitalize(b.status||"confirmed")}</span>
            ${b.bookingRef ? `<span style="font-size:.75rem;color:#5a6a8a">${b.bookingRef}</span>` : ""}
          </div>
          <div class="qi-date">${b.date||""}</div>
        </div>`;
      }).join("");
    }).catch(e => console.error("Bookings load:", e));
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
  }).catch(e => console.error("Profile load:", e));
}

function saveProfile() {
  if (!currentUser || !window._firebase) return;
  const name  = document.getElementById("profileName")?.value.trim();
  const msgEl = document.getElementById("profileMsg");
  if (!name) { if (msgEl) { msgEl.textContent = "Name cannot be empty."; msgEl.style.color = "#e53e3e"; } return; }
  window._firebase.db.collection("users").doc(currentUser.uid).update({ name })
    .then(() => {
      currentUser.updateProfile({ displayName: name });
      if (msgEl) { msgEl.textContent = "✅ Profile saved!"; msgEl.style.color = "#00a357"; }
      updateNavForUser(currentUser);
    })
    .catch(e => { if (msgEl) { msgEl.textContent = "Error: " + e.message; msgEl.style.color = "#e53e3e"; } });
}

function savePreferences() {
  if (!currentUser || !window._firebase) return;
  const prefEmail = document.getElementById("prefEmail")?.checked;
  const prefSMS   = document.getElementById("prefSMS")?.checked;
  window._firebase.db.collection("users").doc(currentUser.uid)
    .update({ prefEmail, prefSMS }).catch(e => console.error("Prefs save:", e));
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
