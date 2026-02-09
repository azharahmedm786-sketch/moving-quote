let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

let lastQuoteData = null;

/* ---------- BOOKING ID ---------- */
function generateBookingID() {
  return "PZ" + Date.now().toString().slice(-6);
}

/* ---------- SAVE LEAD ---------- */
function saveLead(data) {
  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

/* ---------- INIT AUTOCOMPLETE ---------- */
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

  setupCurrentLocation();
}

/* ---------- CURRENT LOCATION ---------- */
function setupCurrentLocation() {

  const toggle =
    document.getElementById("useCurrentLocation");

  if (!toggle) return;

  toggle.addEventListener("change", function () {

    if (!this.checked) return;

    navigator.geolocation.getCurrentPosition(
      pos => {

        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ location: loc },
          (results, status) => {

            if (status === "OK" && results[0]) {

              pickup.value =
                results[0].formatted_address;

              pickupPlace = {
                geometry: { location: loc }
              };

              showLocation("pickup");
              calculateQuote(true);
            }
          });
      },
      () => alert("Location permission denied")
    );

  });
}

/* ---------- SHOW LOCATION ---------- */
function showLocation(type) {

  const place =
    type === "pickup" ? pickupPlace : dropPlace;

  if (!place?.geometry) return;

  const loc = place.geometry.location;

  const mapDiv =
    document.getElementById("map");

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
    if (pickupMarker) pickupMarker.setMap(null);

    pickupMarker = new google.maps.Marker({
      map,
      position: loc,
      draggable: true,
      label: "P"
    });

    marker = pickupMarker;
  }

  if (type === "drop") {
    if (dropMarker) dropMarker.setMap(null);

    dropMarker = new google.maps.Marker({
      map,
      position: loc,
      draggable: true,
      label: "D"
    });

    marker = dropMarker;
  }

  marker.addListener("dragend", () =>
    updateAddress(type, marker.getPosition())
  );

  adjustBounds();
}

/* ---------- UPDATE ADDRESS ---------- */
function updateAddress(type, latlng) {

  const geocoder = new google.maps.Geocoder();

  geocoder.geocode({ location: latlng },
    (res, status) => {

      if (status === "OK" && res[0]) {

        document.getElementById(type).value =
          res[0].formatted_address;

        if (type === "pickup")
          pickupPlace =
            { geometry: { location: latlng } };
        else
          dropPlace =
            { geometry: { location: latlng } };

        adjustBounds();
        calculateQuote(true);
      }
    });
}

/* ---------- ROUTE + ZOOM ---------- */
function adjustBounds() {

  if (!map) return;

  const bounds =
    new google.maps.LatLngBounds();

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

  const houseBase =
    Number(house.value || 0);

  const vehicleRate =
    Number(vehicle.value || 0);

  if (!houseBase || !vehicleRate) {
    if (!auto)
      alert("Select house & vehicle");
    return;
  }

  let furnitureCost = 0;
  let furnitureList = [];

  if (sofaCheck.checked) {
    const qty =
      Number(sofaQty.value || 1);
    furnitureCost += 500 * qty;
    furnitureList.push("Sofa x" + qty);
  }

  if (bedCheck.checked) {
    const qty =
      Number(bedQty.value || 1);
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

    if (status !== "OK" ||
        !res.rows[0].elements[0].distance)
      return;

    const km =
      res.rows[0].elements[0]
        .distance.value / 1000;

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

    const priceBox =
      document.getElementById("livePrice");

    if (priceBox)
      priceBox.innerText =
        "₹" + Math.round(total);

    lastQuoteData = {
      distance: km.toFixed(1),
      total: Math.round(total),
      furniture:
        furnitureList.join(", ")
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

    const bookingID =
      generateBookingID();

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
      "\nConfirmation will arrive on WhatsApp."
    );

    const message =
      `Booking ID: ${bookingID}
Pickup: ${pickup.value}
Drop: ${drop.value}
Distance: ${lastQuoteData.distance} km
Furniture: ${lastQuoteData.furniture}
Total: ₹${lastQuoteData.total}`;

    window.open(
      "https://wa.me/919945095453?text=" +
      encodeURIComponent(message),
      "_blank"
    );

  }, 500);
}

/* ---------- STEP NAVIGATION ---------- */
let currentStep = 0;
let steps = [];

window.addEventListener("load", () => {
  steps =
    document.querySelectorAll(".form-step");
  showStep(currentStep);
});

function showStep(n) {

  steps.forEach(step =>
    step.classList.remove("active"));

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
