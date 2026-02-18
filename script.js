/* ============================================
   PackZen — Premium script.js
   All logic + animations combined
   ============================================ */

let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE   = 400;

/* ============================================
   ON PAGE LOAD — ANIMATIONS & UI
   ============================================ */
document.addEventListener("DOMContentLoaded", () => {

  /* -- Scroll Reveal -- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal, .reveal-stagger")
    .forEach(el => revealObserver.observe(el));

  /* -- Stats Counter -- */
  function animateCounter(el) {
    const target   = parseInt(el.dataset.target);
    const duration = 2000;
    const start    = performance.now();
    function update(time) {
      const progress = Math.min((time - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(update);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(update);
  }

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll(".stat-number").forEach(animateCounter);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  const statsStrip = document.getElementById("statsStrip");
  if (statsStrip) statsObserver.observe(statsStrip);

  /* -- Ripple on Buttons -- */
  document.querySelectorAll("button, .btn-primary, .btn-ghost").forEach(btn => {
    btn.addEventListener("click", function(e) {
      const ripple = document.createElement("span");
      ripple.classList.add("ripple");
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width  = ripple.style.height = size + "px";
      ripple.style.left   = e.clientX - rect.left - size / 2 + "px";
      ripple.style.top    = e.clientY - rect.top  - size / 2 + "px";
      this.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    });
  });

  /* -- Price Pop -- */
  const priceEl = document.getElementById("livePrice");
  if (priceEl) {
    new MutationObserver(() => {
      priceEl.classList.remove("updated");
      void priceEl.offsetWidth;
      priceEl.classList.add("updated");
    }).observe(priceEl, { childList: true });
  }

  /* -- WhatsApp Button Spinner -- */
  const waBtn = document.querySelector(".btn-whatsapp");
  if (waBtn) {
    waBtn.addEventListener("click", () => {
      const orig = waBtn.innerHTML;
      waBtn.innerHTML  = `Sending... <span class="price-loading"></span>`;
      waBtn.disabled   = true;
      setTimeout(() => { waBtn.innerHTML = orig; waBtn.disabled = false; }, 2000);
    }, { capture: true });
  }

  /* -- Smooth Scroll -- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", function(e) {
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* -- Navbar scroll effect -- */
  const navbar = document.querySelector(".navbar");
  window.addEventListener("scroll", () => {
    navbar.style.background = window.scrollY > 50
      ? "rgba(5,13,26,0.97)"
      : "rgba(5,13,26,0.85)";
  }, { passive: true });

}); // end DOMContentLoaded


/* ============================================
   SAVE LEAD
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


/* ============================================
   GOOGLE MAPS AUTOCOMPLETE
   ============================================ */
function initAutocomplete() {

  const pickupInput = document.getElementById("pickup");
  const dropInput   = document.getElementById("drop");

  const pickupAuto = new google.maps.places.Autocomplete(pickupInput);
  const dropAuto   = new google.maps.places.Autocomplete(dropInput);

  pickupAuto.addListener("place_changed", () => {
    pickupPlace = pickupAuto.getPlace();
    showLocation("pickup");
    calculateQuote(true);
  });

  dropAuto.addListener("place_changed", () => {
    dropPlace = dropAuto.getPlace();
    showLocation("drop");
    calculateQuote(true);
  });

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
            showLocation("pickup");
            calculateQuote(true);
          }
        });
      });
    });
  }

  attachAutoCalculation();
}


/* ============================================
   AUTO PRICE ON FIELD CHANGE
   ============================================ */
function attachAutoCalculation() {
  [house, vehicle, sofaCheck, sofaQty, bedCheck, bedQty, fridgeCheck, wmCheck]
    .forEach(el => {
      if (!el) return;
      el.addEventListener("change", () => calculateQuote(true));
    });
}


/* ============================================
   MAP DISPLAY
   ============================================ */
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

  let marker;

  if (type === "pickup") {
    if (pickupMarker) pickupMarker.setMap(null);
    pickupMarker = new google.maps.Marker({ map, position: loc, draggable: true, label: "P" });
    marker = pickupMarker;
  } else {
    if (dropMarker) dropMarker.setMap(null);
    dropMarker = new google.maps.Marker({ map, position: loc, draggable: true, label: "D" });
    marker = dropMarker;
  }

  marker.addListener("dragend", () => updateAddress(type, marker.getPosition()));
  adjustBounds();
}


/* ============================================
   UPDATE ADDRESS AFTER DRAG
   ============================================ */
function updateAddress(type, latlng) {
  new google.maps.Geocoder().geocode({ location: latlng }, (res, status) => {
    if (status === "OK" && res[0]) {
      document.getElementById(type).value = res[0].formatted_address;
      if (type === "pickup") pickupPlace = { geometry: { location: latlng } };
      else                   dropPlace   = { geometry: { location: latlng } };
      adjustBounds();
      calculateQuote(true);
    }
  });
}


/* ============================================
   ROUTE + AUTO ZOOM
   ============================================ */
function adjustBounds() {
  if (!map) return;
  const bounds = new google.maps.LatLngBounds();
  if (pickupPlace?.geometry) bounds.extend(pickupPlace.geometry.location);
  if (dropPlace?.geometry)   bounds.extend(dropPlace.geometry.location);
  if (!bounds.isEmpty()) map.fitBounds(bounds);

  if (pickupPlace && dropPlace) {
    directionsService.route({
      origin:      pickupPlace.geometry.location,
      destination: dropPlace.geometry.location,
      travelMode:  "DRIVING"
    }, (res, status) => {
      if (status === "OK") directionsRenderer.setDirections(res);
    });
  }
}


/* ============================================
   PRICE CALCULATION
   ============================================ */
function calculateQuote(auto = false) {

  if (!pickup.value || !drop.value) {
    if (!auto) alert("Enter pickup & drop locations");
    return;
  }

  const houseBase   = Number(house.value   || 0);
  const vehicleRate = Number(vehicle.value || 0);

  if (!houseBase || !vehicleRate) {
    if (!auto) alert("Select house type & vehicle");
    return;
  }

  let furnitureCost = 0;
  if (sofaCheck.checked)   furnitureCost += 500 * Number(sofaQty.value || 1);
  if (bedCheck.checked)    furnitureCost += 700 * Number(bedQty.value  || 1);
  if (fridgeCheck.checked) furnitureCost += FRIDGE_PRICE;
  if (wmCheck.checked)     furnitureCost += 400;

  new google.maps.DistanceMatrixService().getDistanceMatrix({
    origins:      [pickup.value],
    destinations: [drop.value],
    travelMode:   "DRIVING"
  }, (res, status) => {
    if (status !== "OK") return;

    const km           = res.rows[0].elements[0].distance.value / 1000;
    const distanceCost = km * vehicleRate;
    const total        = MIN_BASE_PRICE + houseBase + distanceCost + furnitureCost;

    result.innerHTML = `
      Distance: ${km.toFixed(1)} km &nbsp;|&nbsp;
      Furniture: ₹${furnitureCost}<br>
      <strong>Total Estimate: ₹${Math.round(total)}</strong>
    `;

    const priceEl = document.getElementById("livePrice");
    if (priceEl) priceEl.innerText = "₹" + Math.round(total).toLocaleString();
  });
}


/* ============================================
   BOOK ON WHATSAPP
   ============================================ */
function bookOnWhatsApp() {
  calculateQuote(true);
  saveLead();

  const message = "New Moving Request 🚚\n\n" + result.innerText;
  window.open(`https://wa.me/919945095453?text=${encodeURIComponent(message)}`, "_blank");
}


/* ============================================
   MULTI-STEP FORM
   ============================================ */
let currentStep = 0;
const steps     = document.querySelectorAll(".form-step");

function updateStepDots(n) {
  document.querySelectorAll(".step-dot").forEach((dot, i) => {
    dot.classList.remove("active", "done");
    if (i < n)  dot.classList.add("done");
    if (i === n) dot.classList.add("active");
  });
  document.querySelectorAll(".step-line").forEach((line, i) => {
    line.classList.toggle("done", i < n);
  });
}

function showStep(n) {
  steps.forEach(s => s.classList.remove("active"));
  steps[n].classList.add("active");

  // Re-trigger animation
  steps[n].style.animation = "none";
  void steps[n].offsetWidth;
  steps[n].style.animation = "";

  progressBar.style.width = ((n + 1) / steps.length) * 100 + "%";
  updateStepDots(n);

  if (n === steps.length - 1) calculateQuote(true);
}

function nextStep() {
  if (currentStep === 0 && (!pickup.value || !drop.value)) {
    alert("Please enter pickup & drop locations");
    return;
  }
  if (currentStep === 1 && (!house.value || !vehicle.value)) {
    alert("Please select house type & vehicle");
    return;
  }
  if (currentStep < steps.length - 1) {
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    showStep(currentStep);
  }
}
