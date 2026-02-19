/* ============================================
   PackZen — script.js
   Includes: Maps, Quote Calc, Auth, Dashboard
   ============================================ */

// ─── State ───────────────────────────────────
let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;
let lastCalculatedTotal = 0;
let paymentReceiptId    = "";
let confirmationResult  = null; // for OTP
let pendingSignupData   = null; // temp store during OTP
let currentUser         = null;
let otpPurpose          = "signup"; // "signup" or "recover"

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE   = 400;
const RAZORPAY_KEY   = "YOUR_RAZORPAY_KEY_ID"; // 🔑 Add later

/* ============================================
   PAGE LOAD — ANIMATIONS & AUTH LISTENER
   ============================================ */
document.addEventListener("DOMContentLoaded", () => {

  /* -- Scroll Reveal -- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); revealObs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal, .reveal-stagger").forEach(el => revealObs.observe(el));

  /* -- Stats Counter -- */
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

  /* -- Ripple -- */
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

  /* -- Price Pop -- */
  const priceEl = document.getElementById("livePrice");
  if (priceEl) new MutationObserver(() => { priceEl.classList.remove("updated"); void priceEl.offsetWidth; priceEl.classList.add("updated"); }).observe(priceEl, { childList: true });

  /* -- Smooth Scroll -- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", function(e) {
      const t = document.querySelector(this.getAttribute("href"));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); }
    });
  });

  /* -- Navbar scroll -- */
  const navbar = document.querySelector(".navbar");
  window.addEventListener("scroll", () => {
    navbar.style.background = window.scrollY > 50 ? "rgba(5,13,26,0.97)" : "rgba(5,13,26,0.85)";
  }, { passive: true });

  /* -- Close dropdown when clicking outside -- */
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-user")) {
      document.getElementById("userDropdown")?.classList.remove("open");
    }
  });

  /* -- Auth state listener -- */
  waitForFirebase(() => {
    const { auth } = window._firebase;
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      updateNavForUser(user);
    });
  });

});

/* ============================================
   FIREBASE HELPER — wait until loaded
   ============================================ */
function waitForFirebase(cb, tries = 0) {
  if (window._firebase) { cb(); return; }
  if (tries > 30) { console.warn("Firebase not loaded"); return; }
  setTimeout(() => waitForFirebase(cb, tries + 1), 200);
}

/* ============================================
   NAV — UPDATE FOR LOGGED IN / OUT USER
   ============================================ */
function updateNavForUser(user) {
  const loginBtn = document.getElementById("navLoginBtn");
  const navUser  = document.getElementById("navUser");
  const navAvatar = document.getElementById("navAvatar");
  const navName  = document.getElementById("navUserName");

  if (user) {
    loginBtn.style.display = "none";
    navUser.style.display  = "flex";
    const name = user.displayName || user.email?.split("@")[0] || "User";
    navName.textContent    = name.split(" ")[0];
    navAvatar.textContent  = name.charAt(0).toUpperCase();
  } else {
    loginBtn.style.display = "inline-block";
    navUser.style.display  = "none";
  }
}

function toggleUserMenu() {
  document.getElementById("userDropdown").classList.toggle("open");
}

/* ============================================
   AUTH MODAL — OPEN / CLOSE / SWITCH
   ============================================ */
function openAuthModal(panel = "login") {
  document.getElementById("authModal").style.display = "flex";
  switchPanel(panel === "login" ? "panelLogin" : "panelSignup");
}

function closeAuthModal() {
  document.getElementById("authModal").style.display = "none";
  clearAuthErrors();
}

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
   SIGNUP — Step 1: collect info & send OTP
   ============================================ */
function signupUser() {
  const name     = document.getElementById("signupName").value.trim();
  const email    = document.getElementById("signupEmail").value.trim();
  const phone    = document.getElementById("signupPhone").value.trim();
  const password = document.getElementById("signupPassword").value;

  if (!name)                       return showError("signupError", "Please enter your name.");
  if (!email.includes("@"))        return showError("signupError", "Please enter a valid email.");
  if (phone.length !== 10)         return showError("signupError", "Please enter a valid 10-digit phone.");
  if (password.length < 6)         return showError("signupError", "Password must be at least 6 characters.");

  waitForFirebase(() => {
    const { auth, signInWithPhoneNumber } = window._firebase;

    // Store signup data to use after OTP
    pendingSignupData = { name, email, password, phone };
    otpPurpose = "signup";

    // Setup invisible reCAPTCHA
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
        size: "invisible",
        callback: () => {}
      });
    }

    const phoneNumber = "+91" + phone;
    signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
      .then((result) => {
        confirmationResult = result;
        document.getElementById("otpSubText").textContent =
          `OTP sent to +91 ${phone}. Enter below to verify.`;
        switchPanel("panelOTP");
        // Focus first OTP box
        document.querySelector(".otp-box")?.focus();
      })
      .catch((err) => {
        console.error(err);
        showError("signupError", "Failed to send OTP. Check your phone number and try again.");
      });
  });
}

/* ============================================
   OTP INPUT — auto advance boxes
   ============================================ */
function otpInput(el, index) {
  el.value = el.value.replace(/\D/g, ""); // numbers only
  if (el.value && index < 5) {
    const boxes = document.querySelectorAll(".otp-box");
    boxes[index + 1]?.focus();
  }
}

function getOTPValue() {
  return Array.from(document.querySelectorAll(".otp-box")).map(b => b.value).join("");
}

/* ============================================
   VERIFY OTP
   ============================================ */
function verifyOTP() {
  const code = getOTPValue();
  if (code.length !== 6) return showError("otpError", "Please enter all 6 digits.");

  if (!confirmationResult) return showError("otpError", "OTP session expired. Please go back and try again.");

  confirmationResult.confirm(code)
    .then(async (result) => {
      // Phone verified! Now create email/password account
      if (otpPurpose === "signup" && pendingSignupData) {
        await completeSignup(result.user);
      }
    })
    .catch((err) => {
      console.error(err);
      showError("otpError", "Invalid OTP. Please try again.");
    });
}

async function completeSignup(phoneUser) {
  const { auth, db } = window._firebase;
  const { name, email, password, phone } = pendingSignupData;

  try {
    // Sign out the phone-only user first
    await auth.signOut();

    // Create email/password account
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });

    // Save user profile to Firestore
    await db.collection("users").doc(cred.user.uid).set({
      name, email, phone,
      phoneVerified: true,
      prefEmail: true,
      prefSMS:   true,
      createdAt: new Date().toISOString()
    });

    pendingSignupData = null;
    closeAuthModal();
    showWelcomeToast(name);
  } catch (err) {
    console.error(err);
    if (err.code === "auth/email-already-in-use") {
      showError("otpError", "This email is already registered. Please login instead.");
    } else {
      showError("otpError", "Account creation failed: " + err.message);
    }
  }
}

/* ============================================
   RESEND OTP
   ============================================ */
function resendOTP() {
  // Clear boxes
  document.querySelectorAll(".otp-box").forEach(b => b.value = "");
  // Go back to signup to re-trigger
  if (otpPurpose === "signup") switchPanel("panelSignup");
}

/* ============================================
   LOGIN
   ============================================ */
function loginUser() {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email.includes("@")) return showError("loginError", "Please enter a valid email.");
  if (!password)             return showError("loginError", "Please enter your password.");

  waitForFirebase(() => {
    const { auth } = window._firebase;
    auth.signInWithEmailAndPassword(email, password)
      .then((cred) => {
        closeAuthModal();
        showWelcomeToast(cred.user.displayName || "User");
      })
      .catch((err) => {
        if (err.code === "auth/user-not-found")  showError("loginError", "No account found with this email.");
        else if (err.code === "auth/wrong-password") showError("loginError", "Incorrect password. Try again.");
        else showError("loginError", "Login failed. Please try again.");
      });
  });
}

/* ============================================
   ACCOUNT RECOVERY
   ============================================ */
function recoverAccount() {
  const email = document.getElementById("recoverEmail").value.trim();
  if (!email.includes("@")) return showError("recoverMsg", "Please enter a valid email.");

  waitForFirebase(() => {
    const { auth } = window._firebase;
    auth.sendPasswordResetEmail(email)
      .then(() => {
        showError("recoverMsg", "✅ Reset link sent! Check your email inbox.", true);
      })
      .catch(() => {
        showError("recoverMsg", "No account found with this email.");
      });
  });
}

/* ============================================
   SIGN OUT
   ============================================ */
function signOutUser() {
  waitForFirebase(() => {
    window._firebase.auth.signOut()
      .then(() => {
        document.getElementById("userDropdown").classList.remove("open");
        showWelcomeToast("Signed out successfully", false);
      });
  });
}

/* ============================================
   WELCOME TOAST
   ============================================ */
function showWelcomeToast(name, isLogin = true) {
  const existing = document.getElementById("toastMsg");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toastMsg";
  toast.className = "toast-msg";
  toast.textContent = isLogin ? `👋 Welcome, ${name}!` : name;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 400); }, 3000);
}

/* ============================================
   DASHBOARD — OPEN / CLOSE / TABS
   ============================================ */
function openDashboard() {
  document.getElementById("userDropdown").classList.remove("open");
  if (!currentUser) { openAuthModal("login"); return; }

  // Fill header
  const name = currentUser.displayName || "User";
  document.getElementById("dashName").textContent  = name;
  document.getElementById("dashEmail").textContent = currentUser.email || "";
  document.getElementById("dashAvatar").textContent = name.charAt(0).toUpperCase();

  // Load quotes
  loadUserQuotes();

  document.getElementById("dashboardModal").style.display = "flex";
  switchDashTab("quotes", document.querySelector(".dash-tab"));
}

function closeDashboard() {
  document.getElementById("dashboardModal").style.display = "none";
}

function switchDashTab(tab, btn) {
  document.querySelectorAll(".dash-content").forEach(c => c.style.display = "none");
  document.querySelectorAll(".dash-tab").forEach(b => b.classList.remove("active"));

  document.getElementById("dash" + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = "block";
  if (btn) btn.classList.add("active");

  if (tab === "profile") loadProfile();
  if (tab === "bookings") loadBookings();
}

function openProfile() {
  document.getElementById("userDropdown").classList.remove("open");
  openDashboard();
  setTimeout(() => switchDashTab("profile", document.querySelectorAll(".dash-tab")[2]), 100);
}

/* ============================================
   LOAD USER QUOTES FROM FIRESTORE
   ============================================ */
async function loadUserQuotes() {
  if (!currentUser || !window._firebase) return;
  const { db } = window._firebase;

  try {
    const snap = await db.collection("quotes").where("uid", "==", currentUser.uid).get();
    const list = document.getElementById("quotesList");

    if (snap.empty) {
      list.innerHTML = '<div class="dash-empty">No saved quotes yet.<br>Get a quote and it will appear here!</div>';
      return;
    }

    list.innerHTML = "";
    snap.forEach(d => {
      const data = d.data();
      list.innerHTML += `
        <div class="quote-item">
          <div class="qi-route">📍 ${data.pickup || "-"} → ${data.drop || "-"}</div>
          <div class="qi-details">
            <span>🏠 ${data.house || "-"}</span>
            <span>🚚 ${data.vehicle || "-"}</span>
            <span class="qi-price">₹${data.total || "0"}</span>
          </div>
          <div class="qi-date">${data.date || ""}</div>
        </div>`;
    });
  } catch (e) {
    console.error("Error loading quotes:", e);
  }
}

/* ============================================
   LOAD BOOKINGS
   ============================================ */
async function loadBookings() {
  if (!currentUser || !window._firebase) return;
  const { db } = window._firebase;

  try {
    const snap = await db.collection("bookings").where("uid", "==", currentUser.uid).get();
    const list = document.getElementById("bookingsList");

    if (snap.empty) {
      list.innerHTML = '<div class="dash-empty">No bookings yet.<br>Book a move and track it here!</div>';
      return;
    }

    list.innerHTML = "";
    snap.forEach(d => {
      const data = d.data();
      const statusColor = { "Confirmed": "#00a357", "Pending": "#d97706", "Completed": "#0057ff" }[data.status] || "#666";
      list.innerHTML += `
        <div class="quote-item">
          <div class="qi-route">📍 ${data.pickup || "-"} → ${data.drop || "-"}</div>
          <div class="qi-details">
            <span>📅 ${data.moveDate || "-"}</span>
            <span class="qi-price">₹${data.total || "0"}</span>
            <span class="qi-status" style="color:${statusColor};">● ${data.status || "Pending"}</span>
          </div>
        </div>`;
    });
  } catch (e) {
    console.error("Error loading bookings:", e);
  }
}

/* ============================================
   LOAD & SAVE PROFILE
   ============================================ */
async function loadProfile() {
  if (!currentUser || !window._firebase) return;
  const { db } = window._firebase;

  document.getElementById("profileEmail").value = currentUser.email || "";

  try {
    const snap = await db.collection("users").doc(currentUser.uid).get();
    if (snap.exists) {
      const data = snap.data();
      document.getElementById("profileName").value  = data.name  || currentUser.displayName || "";
      document.getElementById("profilePhone").value = data.phone || "";
      document.getElementById("prefEmail").checked  = data.prefEmail !== false;
      document.getElementById("prefSMS").checked    = data.prefSMS   !== false;
    }
  } catch (e) { console.error("Error loading profile:", e); }
}

async function saveProfile() {
  if (!currentUser || !window._firebase) return;
  const { auth, db } = window._firebase;

  const name = document.getElementById("profileName").value.trim();
  if (!name) return showError("profileMsg", "Name cannot be empty.");

  try {
    await auth.currentUser.updateProfile({ displayName: name });
    await db.collection("users").doc(currentUser.uid).set({
      name,
      email:     currentUser.email,
      prefEmail: document.getElementById("prefEmail").checked,
      prefSMS:   document.getElementById("prefSMS").checked,
    }, { merge: true });

    showError("profileMsg", "✅ Profile saved!", true);
    updateNavForUser(auth.currentUser);
  } catch (e) {
    showError("profileMsg", "Error saving: " + e.message);
  }
}

function savePreferences() {
  saveProfile(); // auto-save when toggle changes
}

/* ============================================
   SAVE QUOTE TO FIRESTORE (after calculation)
   ============================================ */
async function saveQuoteToFirestore(total) {
  if (!currentUser || !window._firebase) return;
  const { db } = window._firebase;

  try {
    const houseEl   = document.getElementById("house");
    const vehicleEl = document.getElementById("vehicle");
    await db.collection("quotes").add({
      uid:     currentUser.uid,
      pickup:  pickup?.value  || "",
      drop:    drop?.value    || "",
      house:   houseEl?.options[houseEl.selectedIndex]?.text   || "",
      vehicle: vehicleEl?.options[vehicleEl.selectedIndex]?.text || "",
      total:   total,
      date:    new Date().toLocaleDateString("en-IN"),
    });
  } catch (e) { console.error("Error saving quote:", e); }
}

/* ============================================
   GOOGLE MAPS + AUTOCOMPLETE
   ============================================ */
function initAutocomplete() {
  const pickupInput = document.getElementById("pickup");
  const dropInput   = document.getElementById("drop");

  const pickupAuto = new google.maps.places.Autocomplete(pickupInput);
  const dropAuto   = new google.maps.places.Autocomplete(dropInput);

  pickupAuto.addListener("place_changed", () => { pickupPlace = pickupAuto.getPlace(); showLocation("pickup"); calculateQuote(true); });
  dropAuto.addListener("place_changed",   () => { dropPlace   = dropAuto.getPlace();   showLocation("drop");   calculateQuote(true); });

  const toggle = document.getElementById("useCurrentLocation");
  if (toggle) {
    toggle.addEventListener("change", () => {
      if (!toggle.checked) return;
      navigator.geolocation.getCurrentPosition(pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        new google.maps.Geocoder().geocode({ location: loc }, (res, status) => {
          if (status === "OK" && res[0]) {
            pickupInput.value = res[0].formatted_address;
            pickupPlace = { geometry: { location: loc } };
            showLocation("pickup"); calculateQuote(true);
          }
        });
      });
    });
  }
  attachAutoCalculation();
}

function attachAutoCalculation() {
  [house, vehicle, sofaCheck, sofaQty, bedCheck, bedQty, fridgeCheck, wmCheck]
    .forEach(el => el?.addEventListener("change", () => calculateQuote(true)));
}

function showLocation(type) {
  const mapDiv = document.getElementById("map");
  const place  = type === "pickup" ? pickupPlace : dropPlace;
  if (!place?.geometry) return;
  const loc = place.geometry.location;

  if (!map) {
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
  if (!pickup?.value || !drop?.value) { if (!auto) alert("Enter pickup & drop"); return; }

  const houseBase   = Number(house?.value   || 0);
  const vehicleRate = Number(vehicle?.value || 0);
  if (!houseBase || !vehicleRate) { if (!auto) alert("Select house & vehicle"); return; }

  let furnitureCost = 0;
  if (sofaCheck?.checked)   furnitureCost += 500 * Number(sofaQty?.value || 1);
  if (bedCheck?.checked)    furnitureCost += 700 * Number(bedQty?.value  || 1);
  if (fridgeCheck?.checked) furnitureCost += FRIDGE_PRICE;
  if (wmCheck?.checked)     furnitureCost += 400;

  new google.maps.DistanceMatrixService().getDistanceMatrix({
    origins: [pickup.value], destinations: [drop.value], travelMode: "DRIVING"
  }, (res, status) => {
    if (status !== "OK") return;
    const km    = res.rows[0].elements[0].distance.value / 1000;
    const total = Math.round(MIN_BASE_PRICE + houseBase + (km * vehicleRate) + furnitureCost);

    result.innerHTML = `Distance: ${km.toFixed(1)} km &nbsp;|&nbsp; Furniture: ₹${furnitureCost}<br><strong>Total Estimate: ₹${total.toLocaleString()}</strong>`;

    const priceEl   = document.getElementById("livePrice");
    const advanceEl = document.getElementById("advanceAmount");
    if (priceEl)   priceEl.innerText   = "₹" + total.toLocaleString();
    if (advanceEl) advanceEl.innerText = "₹" + Math.round(total * 0.10).toLocaleString();

    lastCalculatedTotal = total;

    // Auto-save quote if user is logged in
    if (currentUser) saveQuoteToFirestore(total);
  });
}

/* ============================================
   BOOK ON WHATSAPP
   ============================================ */
function saveLead() {
  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec", {
    method: "POST",
    body: JSON.stringify({
      name:   custName?.value  || "",
      phone:  custPhone?.value || "",
      pickup: pickup?.value    || "",
      drop:   drop?.value      || ""
    })
  });
}

function bookOnWhatsApp() {
  calculateQuote(true);
  saveLead();
  const message = "New Moving Request 🚚\n\n" + result.innerText;
  window.open(`https://wa.me/919945095453?text=${encodeURIComponent(message)}`, "_blank");
}

/* ============================================
   RAZORPAY (Ready for when you add key later)
   ============================================ */
function startPayment() {
  const name  = document.getElementById("custName")?.value?.trim();
  const phone = document.getElementById("custPhone")?.value?.trim();
  if (!name)  return alert("Please enter your name.");
  if (!phone || phone.length < 10) return alert("Please enter a valid phone number.");
  if (lastCalculatedTotal === 0)   return alert("Price not calculated yet.");

  if (RAZORPAY_KEY === "YOUR_RAZORPAY_KEY_ID") {
    alert("⚠️ Razorpay not activated yet.\n\nUse 'Book via WhatsApp Only' for now.\nAdd your Razorpay Key ID in script.js when ready.");
    return;
  }

  const advance = Math.round(lastCalculatedTotal * 0.10);
  paymentReceiptId = "PKZ-" + Date.now();

  const rzp = new Razorpay({
    key: RAZORPAY_KEY, amount: advance * 100, currency: "INR",
    name: "PackZen Packers & Movers",
    description: `Advance (10% of ₹${lastCalculatedTotal.toLocaleString()})`,
    receipt: paymentReceiptId,
    prefill: { name, contact: phone },
    theme: { color: "#0057ff" },
    handler: (response) => onPaymentSuccess(response, name, phone, advance),
    modal: { ondismiss: () => {} }
  });
  rzp.open();
  rzp.on("payment.failed", (r) => alert("Payment failed: " + r.error.description));
}

function onPaymentSuccess(response, name, phone, advance) {
  document.getElementById("modalDetail").innerHTML = `
    <strong>Name:</strong> ${name}<br>
    <strong>Phone:</strong> ${phone}<br>
    <strong>Pickup:</strong> ${pickup?.value || "-"}<br>
    <strong>Drop:</strong> ${drop?.value || "-"}<br>
    <strong>Total Estimate:</strong> ₹${lastCalculatedTotal.toLocaleString()}<br>
    <strong>Advance Paid:</strong> ₹${advance.toLocaleString()}<br>
    <strong>Payment ID:</strong> ${response.razorpay_payment_id}`;
  document.getElementById("paymentModal").style.display = "flex";
}

function sendWhatsAppAfterPayment() {
  const msg = `✅ Booking Confirmed — PackZen\n\nPickup: ${pickup?.value}\nDrop: ${drop?.value}\nTotal: ₹${lastCalculatedTotal.toLocaleString()}\nAdvance: ₹${Math.round(lastCalculatedTotal * 0.10).toLocaleString()}\nReceipt: ${paymentReceiptId}`;
  window.open(`https://wa.me/919945095453?text=${encodeURIComponent(msg)}`, "_blank");
}

function closeModal() { document.getElementById("paymentModal").style.display = "none"; }

/* ============================================
   MULTI-STEP FORM
   ============================================ */
let currentStep = 0;
const steps     = document.querySelectorAll(".form-step");

function updateStepDots(n) {
  document.querySelectorAll(".step-dot").forEach((dot, i) => {
    dot.classList.remove("active","done");
    if (i < n)  dot.classList.add("done");
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
  progressBar.style.width = ((n + 1) / steps.length) * 100 + "%";
  updateStepDots(n);
  if (n === steps.length - 1) calculateQuote(true);
}

function nextStep() {
  if (currentStep === 0 && (!pickup?.value || !drop?.value)) return alert("Enter pickup & drop locations.");
  if (currentStep === 1 && (!house?.value  || !vehicle?.value))  return alert("Select house type & vehicle.");
  if (currentStep < steps.length - 1) { currentStep++; showStep(currentStep); }
}

function prevStep() {
  if (currentStep > 0) { currentStep--; showStep(currentStep); }
}
