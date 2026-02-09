let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

/* ---------- SAVE LEAD ---------- */
function saveLead() {
  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec", {
    method: "POST",
    body: JSON.stringify({
      name: custName?.value || "",
      phone: custPhone?.value || "",
      pickup: pickup?.value || "",
      drop: drop?.value || ""
    })
  });
}

/* ---------- INIT GOOGLE MAP ---------- */
function initAutocomplete() {

  const pickupAuto =
    new google.maps.places.Autocomplete(
      document.getElementById("pickup")
    );

  const dropAuto =
    new google.maps.places.Autocomplete(
      document.getElementById("drop")
    );

  pickupAuto.addListener("place_changed", () => {
    pickupPlace = pickupAuto.getPlace();
    showLocation();
    showDistance();
    calculateQuote(true);
  });

  dropAuto.addListener("place_changed", () => {
    dropPlace = dropAuto.getPlace();
    showLocation();
    showDistance();
    calculateQuote(true);
  });

  /* Current location */
  const currentToggle =
    document.getElementById("useCurrentLocation");

  if (currentToggle) {
    currentToggle.addEventListener("change", () => {
      if (!currentToggle.checked) return;

      navigator.geolocation.getCurrentPosition(pos => {

        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ location: loc }, (res, status) => {
          if (status === "OK") {
            pickup.value = res[0].formatted_address;
            pickupPlace = { geometry: { location: loc } };
            showLocation();
            calculateQuote(true);
          }
        });
      });
    });
  }

  attachAutoPriceUpdate();
}

/* ---------- AUTO PRICE UPDATE ---------- */
function attachAutoPriceUpdate() {

  const fields = [
    "pickup", "drop",
    "house", "vehicle",
    "sofaCheck", "sofaQty",
    "bedCheck", "bedQty",
    "fridgeCheck", "wmCheck"
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("change", () => {
      calculateQuote(true);
      showDistance();
    });
  });
}

/* ---------- MAP DISPLAY ---------- */
function showLocation() {

  if (!pickupPlace?.geometry &&
      !dropPlace?.geometry) return;

  const loc =
    pickupPlace?.geometry?.location ||
    dropPlace.geometry.location;

  const mapDiv = document.getElementById("map");

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: loc,
      zoom: 14
    });

    directionsService =
      new google.maps.DirectionsService();

    directionsRenderer =
      new google.maps.DirectionsRenderer({
        map
      });
  }

  map.setCenter(loc);

  if (pickupPlace && dropPlace) {
    directionsService.route({
      origin: pickupPlace.geometry.location,
      destination: dropPlace.geometry.location,
      travelMode: "DRIVING"
    }, (res, status) => {
      if (status === "OK")
        directionsRenderer.setDirections(res);
    });
  }
}

/* ---------- DISTANCE DISPLAY ---------- */
function showDistance() {

  if (!pickup.value || !drop.value) return;

  const service =
    new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [pickup.value],
    destinations: [drop.value],
    travelMode: "DRIVING"
  }, (res, status) => {

    if (status !== "OK") return;

    const km =
      res.rows[0].elements[0].distance.value / 1000;

    const el =
      document.getElementById("distanceInfo");

    if (el)
      el.innerHTML =
        "Estimated Distance: " +
        km.toFixed(1) + " km";
  });
}

/* ---------- PRICE CALCULATION ---------- */
function calculateQuote(auto = false) {

  if (!pickup.value || !drop.value) {
    if (!auto) alert("Enter locations");
    return;
  }

  const houseBase = Number(house.value || 0);
  const vehicleRate = Number(vehicle.value || 0);

  if (!houseBase || !vehicleRate) {
    if (!auto) alert("Select house & vehicle");
    return;
  }

  let furnitureCost = 0;

  if (sofaCheck.checked)
    furnitureCost += 500 *
      Number(sofaQty.value || 1);

  if (bedCheck.checked)
    furnitureCost += 700 *
      Number(bedQty.value || 1);

  if (fridgeCheck.checked)
    furnitureCost += FRIDGE_PRICE;

  if (wmCheck?.checked)
    furnitureCost += 400;

  const service =
    new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [pickup.value],
    destinations: [drop.value],
    travelMode: "DRIVING"
  }, (res, status) => {

    if (status !== "OK") return;

    const km =
      res.rows[0].elements[0].distance.value / 1000;

    const distanceCost =
      km * vehicleRate;

    const total =
      MIN_BASE_PRICE +
      houseBase +
      distanceCost +
      furnitureCost;

    result.innerHTML = `
Distance: ${km.toFixed(1)} km<br>
Furniture: ₹${furnitureCost}<br>
<strong>Total Estimate: ₹${Math.round(total)}</strong>`;

    const livePrice =
      document.getElementById("livePrice");

    if (livePrice)
      livePrice.innerText =
        "₹" + Math.round(total);
  });
}

/* ---------- BOOKING ---------- */
function bookOnWhatsApp() {

  calculateQuote(true);

  setTimeout(() => {

    saveLead();

    const message =
      "New Moving Request 🚚\n\n" +
      document.getElementById("result").innerText;

    window.open(
      "https://wa.me/919945095453?text=" +
      encodeURIComponent(message),
      "_blank"
    );

  }, 800);
}

/* ---------- STEP FORM ---------- */
let currentStep = 0;

const steps =
  document.querySelectorAll(".form-step");

function showStep(n) {

  steps.forEach(s =>
    s.classList.remove("active"));

  steps[n].classList.add("active");

  const bar =
    document.getElementById("progressBar");

  if (bar)
    bar.style.width =
      ((n + 1) / steps.length) * 100 + "%";

  if (n === steps.length - 1)
    calculateQuote(true);
}

function nextStep() {

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
