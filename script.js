let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

let lastQuoteData = null;

/* ---------- BOOKING ID ---------- */
function generateBookingID() {
  const time = Date.now().toString().slice(-6);
  return "PZ" + time;
}

/* ---------- SAVE LEAD ---------- */
function saveLead(data) {
  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

/* ---------- MAP INIT ---------- */
function initAutocomplete() {

  const pickupInput = document.getElementById("pickup");
  const dropInput = document.getElementById("drop");

  const pickupAuto =
    new google.maps.places.Autocomplete(pickupInput);

  const dropAuto =
    new google.maps.places.Autocomplete(dropInput);

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
}

/* ---------- MAP + MARKERS ---------- */
function showLocation(type) {

  const mapDiv = document.getElementById("map");

  const place =
    type === "pickup" ? pickupPlace : dropPlace;

  if (!place || !place.geometry) return;

  const loc = place.geometry.location;

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: loc,
      zoom: 14
    });

    directionsService =
      new google.maps.DirectionsService();

    directionsRenderer =
      new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true
      });
  }

  map.setCenter(loc);

  let marker;

  if (type === "pickup") {

    if (pickupMarker)
      pickupMarker.setMap(null);

    pickupMarker = new google.maps.Marker({
      map,
      position: loc,
      draggable: true,
      label: "P"
    });

    marker = pickupMarker;
  }

  if (type === "drop") {

    if (dropMarker)
      dropMarker.setMap(null);

    dropMarker = new google.maps.Marker({
      map,
      position: loc,
      draggable: true,
      label: "D"
    });

    marker = dropMarker;
  }

  marker.addListener("dragend", function () {
    updateAddress(type, marker.getPosition());
  });

  adjustBounds();
}

/* ---------- UPDATE ADDRESS AFTER DRAG ---------- */
function updateAddress(type, latlng) {

  const geocoder = new google.maps.Geocoder();

  geocoder.geocode({ location: latlng }, (res, status) => {

    if (status === "OK" && res[0]) {

      document.getElementById(type).value =
        res[0].formatted_address;

      if (type === "pickup")
        pickupPlace = { geometry: { location: latlng } };
      else
        dropPlace = { geometry: { location: latlng } };

      adjustBounds();
      calculateQuote(true);
    }
  });
}

/* ---------- AUTO ZOOM + ROUTE ---------- */
function adjustBounds() {

  if (!map) return;

  const bounds = new google.maps.LatLngBounds();

  if (pickupPlace?.geometry)
    bounds.extend(pickupPlace.geometry.location);

  if (dropPlace?.geometry)
    bounds.extend(dropPlace.geometry.location);

  if (!bounds.isEmpty())
    map.fitBounds(bounds);

  if (pickupPlace && dropPlace) {
    directionsService.route({
      origin: pickupPlace.geometry.location,
      destination: dropPlace.geometry.location,
      travelMode: "DRIVING"
    }, (result, status) => {
      if (status === "OK")
        directionsRenderer.setDirections(result);
    });
  }
}

/* ---------- PRICE CALC ---------- */
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
  let furnitureList = [];

  if (sofaCheck.checked) {
    const qty = Number(sofaQty.value || 1);
    furnitureCost += 500 * qty;
    furnitureList.push("Sofa x" + qty);
  }

  if (bedCheck.checked) {
    const qty = Number(bedQty.value || 1);
    furnitureCost += 700 * qty;
    furnitureList.push("Bed x" + qty);
  }

  if (fridgeCheck.checked) {
    furnitureCost += FRIDGE_PRICE;
    furnitureList.push("Fridge");
  }

  const service =
    new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [pickup.value],
    destinations: [drop.value],
    travelMode: "DRIVING"
  }, (res, status) => {

    if (
      status !== "OK" ||
      !res.rows[0].elements[0].distance
    ) return;

    const km =
      res.rows[0].elements[0].distance.value / 1000;

    const distanceCost = km * vehicleRate;

    const total =
      MIN_BASE_PRICE +
      houseBase +
      distanceCost +
      furnitureCost;

    result.innerHTML = `
Distance: ${km.toFixed(1)} km<br>
Furniture: ₹${furnitureCost}<br>
<strong>Total Estimate: ₹${Math.round(total)}</strong>`;

    const priceEl = document.getElementById("livePrice");
    if (priceEl)
      priceEl.innerText =
        "₹" + Math.round(total);

    lastQuoteData = {
      distance: km.toFixed(1),
      total: Math.round(total),
      furniture: furnitureList.join(", "),
      furnitureCost
    };
  });
}

/* ---------- BOOKING ---------- */
function bookOnWhatsApp() {

  calculateQuote(true);

  setTimeout(() => {

    if (!lastQuoteData) {
      alert("Calculate price first");
      return;
    }

    const bookingID = generateBookingID();

    const leadData = {
      bookingID,
      name: custName.value || "",
      phone: custPhone.value || "",
      pickup: pickup.value,
      drop: drop.value,
      distance: lastQuoteData.distance,
      furniture: lastQuoteData.furniture,
      total: lastQuoteData.total
    };

    saveLead(leadData);

    alert(
      "Booking ID: " + bookingID +
      "\nYou will receive confirmation on WhatsApp."
    );

    const message =
      "New Moving Booking 🚚\n\n" +
      "Booking ID: " + bookingID + "\n" +
      "Pickup: " + pickup.value + "\n" +
      "Drop: " + drop.value + "\n" +
      "Distance: " + lastQuoteData.distance + " km\n" +
      "Furniture: " + lastQuoteData.furniture + "\n" +
      "Total: ₹" + lastQuoteData.total;

    window.open(
      "https://wa.me/919945095453?text=" +
      encodeURIComponent(message),
      "_blank"
    );

  }, 600);
}

/* ---------- STEP FORM ---------- */
let currentStep = 0;
let steps = [];

window.addEventListener("load", () => {
  steps = document.querySelectorAll(".form-step");
  showStep(currentStep);
});

function showStep(n) {

  steps.forEach(step =>
    step.classList.remove("active")
  );

  if (steps[n])
    steps[n].classList.add("active");

  const progress =
    document.getElementById("progressBar");

  if (progress)
    progress.style.width =
      ((n + 1) / steps.length) * 100 + "%";

  if (n === steps.length - 1)
    calculateQuote(true);
}

function nextStep() {

  if (currentStep === 0 &&
      (!pickup.value || !drop.value)) {
    alert("Enter pickup & drop");
    return;
  }

  if (currentStep === 1 &&
      (!house.value || !vehicle.value)) {
    alert("Select house & vehicle");
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
