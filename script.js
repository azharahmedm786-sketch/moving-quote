let pickupPlace = null;
let dropPlace = null;

let directionsService;
let directionsRenderer;

let map;
let pickupMarker = null;
let dropMarker = null;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

/* ---------- SAVE LEAD TO GOOGLE SHEETS ---------- */
function saveLead() {

  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec", {
    method: "POST",
    body: JSON.stringify({
      name: document.getElementById("custName")?.value || "",
      phone: document.getElementById("custPhone")?.value || "",
      pickup: document.getElementById("pickup")?.value || "",
      drop: document.getElementById("drop")?.value || ""
    })
  }).catch(() => {});
}

/* ---------- INIT ---------- */
function initAutocomplete() {

  const pickupInput = document.getElementById("pickup");
  const dropInput = document.getElementById("drop");

  if (!pickupInput || !dropInput) return;

  const pickupAutocomplete =
    new google.maps.places.Autocomplete(pickupInput);

  const dropAutocomplete =
    new google.maps.places.Autocomplete(dropInput);

  pickupAutocomplete.addListener("place_changed", () => {
    pickupPlace = pickupAutocomplete.getPlace();
    showLocation("pickup");
    calculateQuote(true);
  });

  dropAutocomplete.addListener("place_changed", () => {
    dropPlace = dropAutocomplete.getPlace();
    showLocation("drop");
    calculateQuote(true);
  });

  const currentLocationCheck =
    document.getElementById("useCurrentLocation");

  if (currentLocationCheck) {
    currentLocationCheck.addEventListener("change", function () {
      if (this.checked) {
        useCurrentLocation();
      } else {
        pickupInput.value = "";
        pickupPlace = null;
        if (pickupMarker) pickupMarker.setMap(null);
      }
    });
  }

  attachAutoCalculation();
}

/* ---------- AUTO CALC ---------- */
function attachAutoCalculation() {

  const ids = [
    "house","vehicle",
    "sofaCheck","sofaType","sofaQty",
    "bedCheck","bedType","bedQty",
    "fridgeCheck",
    "wmCheck","wmType"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change",
      () => calculateQuote(true));
  });
}

/* ---------- CURRENT LOCATION ---------- */
function useCurrentLocation() {

  navigator.geolocation.getCurrentPosition(pos => {

    const loc = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ location: loc }, (res, status) => {
      if (status === "OK" && res[0]) {

        const pickupInput = document.getElementById("pickup");
        pickupInput.value = res[0].formatted_address;

        pickupPlace = { geometry: { location: loc } };

        showLocation("pickup");
        calculateQuote(true);
      }
    });
  });
}

/* ---------- MAP DISPLAY ---------- */
function showLocation(type) {

  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  mapDiv.style.display = "block";

  const place = type === "pickup" ? pickupPlace : dropPlace;
  if (!place || !place.geometry) return;

  const loc = place.geometry.location;

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: loc,
      zoom: 14,
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer =
      new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true
      });
  }

  map.setCenter(loc);

  let marker;

  if (type === "pickup") {
    if (pickupMarker) pickupMarker.setMap(null);
    pickupMarker = new google.maps.Marker({
      map, position: loc, draggable: true, label: "P"
    });
    marker = pickupMarker;
  } else {
    if (dropMarker) dropMarker.setMap(null);
    dropMarker = new google.maps.Marker({
      map, position: loc, draggable: true, label: "D"
    });
    marker = dropMarker;
  }

  marker.addListener("dragend", () => {
    updateAddress(type, marker.getPosition());
  });

  adjustBounds();
}

/* ---------- UPDATE ADDRESS ---------- */
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

/* ---------- ROUTE ---------- */
function adjustBounds() {

  if (!map) return;

  const bounds = new google.maps.LatLngBounds();

  if (pickupPlace)
    bounds.extend(pickupPlace.geometry.location);

  if (dropPlace)
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

/* ---------- QUOTE ---------- */
function calculateQuote(auto = false) {

  const house = document.getElementById("house");
  const vehicle = document.getElementById("vehicle");
  const pickup = document.getElementById("pickup");
  const drop = document.getElementById("drop");

  const houseBase = Number(house?.value || 0);
  const vehicleRate = Number(vehicle?.value || 0);

  if (!pickup?.value || !drop?.value ||
      !houseBase || !vehicleRate) {
    if (!auto) alert("Fill required fields");
    return;
  }

  let furnitureCost = 0;

  if (document.getElementById("sofaCheck")?.checked)
    furnitureCost +=
      Number(document.getElementById("sofaType").value) *
      Number(document.getElementById("sofaQty").value);

  if (document.getElementById("bedCheck")?.checked)
    furnitureCost +=
      Number(document.getElementById("bedType").value) *
      Number(document.getElementById("bedQty").value);

  if (document.getElementById("fridgeCheck")?.checked)
    furnitureCost += FRIDGE_PRICE;

  if (document.getElementById("wmCheck")?.checked)
    furnitureCost += Number(document.getElementById("wmType").value);

  const service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [pickup.value],
    destinations: [drop.value],
    travelMode: "DRIVING",
  }, (res, status) => {

    if (status !== "OK") return;

    const km =
      res.rows[0].elements[0].distance.value / 1000;

    const distanceCost = km * vehicleRate;

    const total =
      MIN_BASE_PRICE +
      houseBase +
      distanceCost +
      furnitureCost;

    document.getElementById("result").innerHTML = `
Distance: ${km.toFixed(1)} km<br>
Furniture: ₹${furnitureCost}<br>
<strong>Total: ₹${Math.round(total)}</strong>`;
  });
}

/* ---------- BOOKING ---------- */
function bookOnWhatsApp() {

  saveLead();

  const resultText =
    document.getElementById("result")?.innerText || "";

  const message =
    "New Moving Request 🚚\n\n" + resultText;

  window.location.href =
    `https://wa.me/919945095453?text=${encodeURIComponent(message)}`;
}
