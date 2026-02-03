let pickupPlace = null;
let dropPlace = null;

let map;
let pickupMarker = null;
let dropMarker = null;
let activeField = null;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

/* =============================
   GOOGLE AUTOCOMPLETE SETUP
============================= */
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
    ensureGeometry("pickup");
  });

  dropAutocomplete.addListener("place_changed", () => {
    dropPlace = dropAutocomplete.getPlace();
    ensureGeometry("drop");
  });
}

/* =============================
   ENSURE GEOMETRY EXISTS
============================= */
function ensureGeometry(type) {
  const place = type === "pickup" ? pickupPlace : dropPlace;

  if (place.geometry) {
    tryShowBothLocations();
    return;
  }

  const address = document.getElementById(type).value;
  const geocoder = new google.maps.Geocoder();

  geocoder.geocode({ address: address }, (results, status) => {
    if (status === "OK" && results[0]) {
      const loc = results[0].geometry.location;

      if (type === "pickup") {
        pickupPlace = { geometry: { location: loc } };
      } else {
        dropPlace = { geometry: { location: loc } };
      }

      tryShowBothLocations();
    }
  });
}

/* =============================
   SHOW BOTH LOCATIONS
============================= */
function tryShowBothLocations() {
  if (!pickupPlace || !dropPlace) return;

  const mapDiv = document.getElementById("map");
  mapDiv.style.display = "block";

  const pickupLoc = pickupPlace.geometry.location;
  const dropLoc = dropPlace.geometry.location;

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: pickupLoc,
      zoom: 12,
    });
  }

  if (pickupMarker) pickupMarker.setMap(null);
  if (dropMarker) dropMarker.setMap(null);

  pickupMarker = new google.maps.Marker({
    map: map,
    position: pickupLoc,
    label: "P"
  });

  dropMarker = new google.maps.Marker({
    map: map,
    position: dropLoc,
    label: "D"
  });

  const bounds = new google.maps.LatLngBounds();
  bounds.extend(pickupLoc);
  bounds.extend(dropLoc);
  map.fitBounds(bounds);
}

/* =============================
   QUOTE CALCULATION
============================= */
function calculateQuote() {

  const shiftDate = document.getElementById("shiftDate").value;
  const shiftTime = document.getElementById("shiftTime").value;

  const houseValue = document.getElementById("house").value;
  const vehicleValue = document.getElementById("vehicle").value;

  if (!shiftDate || !shiftTime || houseValue === "" || vehicleValue === "") {
    alert("Please fill all required fields");
    return;
  }

  const houseBase = parseInt(houseValue);
  const vehicleRate = parseFloat(vehicleValue);

  const pickupText =
    document.getElementById("pickup").value.trim();
  const dropText =
    document.getElementById("drop").value.trim();

  if (!pickupText || !dropText) {
    alert("Please enter pickup and drop locations");
    return;
  }

  let furnitureCost = 0;

  if (sofaCheck.checked)
    furnitureCost += sofaType.value * sofaQty.value;

  if (bedCheck.checked)
    furnitureCost += bedType.value * bedQty.value;

  if (fridgeCheck.checked)
    furnitureCost += FRIDGE_PRICE;

  if (wmCheck.checked)
    furnitureCost += wmType.value;

  const service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [pickupText],
    destinations: [dropText],
    travelMode: "DRIVING",
  }, (response, status) => {

    if (status !== "OK") {
      alert("Distance calculation failed");
      return;
    }

    const km =
      response.rows[0].elements[0].distance.value / 1000;

    const distanceCost = km * vehicleRate;

    const total =
      MIN_BASE_PRICE + houseBase + distanceCost + furnitureCost;

    document.getElementById("result").innerHTML = `
        Estimated Distance: ${km.toFixed(1)} km<br>
        Base: ₹${MIN_BASE_PRICE}<br>
        House: ₹${houseBase}<br>
        Distance: ₹${Math.round(distanceCost)}<br>
        Furniture: ₹${furnitureCost}<br><br>
        <strong>Total: ₹${Math.round(total)}</strong>`;
  });
}

/* =============================
   WHATSAPP BOOKING
============================= */
function bookOnWhatsApp() {

  const name = custName.value.trim();
  const phone = custPhone.value.trim();

  if (!name || !phone) {
    alert("Enter name & phone");
    return;
  }

  const message =
    `New Moving Request 🚚\n\nCustomer: ${name}\nPhone: ${phone}\n\n` +
    document.getElementById("result").innerText;

  window.location.href =
    `https://wa.me/917996062921?text=${encodeURIComponent(message)}`;
}

/* =============================
   MANUAL MAP PIN
============================= */
function openMap(field) {
  activeField = field;

  const mapDiv = document.getElementById("map");
  mapDiv.style.display = "block";

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: { lat: 12.9716, lng: 77.5946 },
      zoom: 13,
    });
  }

  map.addListener("click", function (event) {
    updateManualPin(event.latLng);
    getAddress(event.latLng);
  });

  setTimeout(() => {
    google.maps.event.trigger(map, "resize");
  }, 300);
}

function updateManualPin(location) {

  if (activeField === "pickup") {

    if (pickupMarker) pickupMarker.setMap(null);

    pickupMarker = new google.maps.Marker({
      position: location,
      map: map,
      label: "P"
    });

    pickupPlace = { geometry: { location: location } };

  } else {

    if (dropMarker) dropMarker.setMap(null);

    dropMarker = new google.maps.Marker({
      position: location,
      map: map,
      label: "D"
    });

    dropPlace = { geometry: { location: location } };
  }

  if (pickupPlace && dropPlace) {
    tryShowBothLocations();
  }
}

function getAddress(latlng) {
  const geocoder = new google.maps.Geocoder();

  geocoder.geocode({ location: latlng }, (results, status) => {
    if (status === "OK" && results[0]) {
      document.getElementById(activeField).value =
        results[0].formatted_address;
    }
  });
}
