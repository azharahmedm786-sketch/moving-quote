let pickupPlace = null;
let dropPlace = null;

let map;
let pickupMarker = null;
let dropMarker = null;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

/* =============================
   INIT AUTOCOMPLETE
============================= */
function initAutocomplete() {

  detectCurrentLocation();

  const pickupInput = document.getElementById("pickup");
  const dropInput = document.getElementById("drop");

  const pickupAutocomplete =
    new google.maps.places.Autocomplete(pickupInput);

  const dropAutocomplete =
    new google.maps.places.Autocomplete(dropInput);

  pickupAutocomplete.addListener("place_changed", () => {
    pickupPlace = pickupAutocomplete.getPlace();
    showLocation("pickup");
  });

  dropAutocomplete.addListener("place_changed", () => {
    dropPlace = dropAutocomplete.getPlace();
    showLocation("drop");
  });
}

/* =============================
   DETECT CURRENT LOCATION
============================= */
function detectCurrentLocation() {

  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(pos => {

    const loc = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ location: loc }, (res, status) => {
      if (status === "OK" && res[0]) {

        document.getElementById("pickup").value =
          res[0].formatted_address;

        pickupPlace = { geometry: { location: loc } };

        showLocation("pickup");
      }
    });
  });
}

/* =============================
   SHOW LOCATION ON MAP
============================= */
function showLocation(type) {

  const mapDiv = document.getElementById("map");
  mapDiv.style.display = "block";

  const place = type === "pickup" ? pickupPlace : dropPlace;
  if (!place || !place.geometry) return;

  const loc = place.geometry.location;

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: loc,
      zoom: 16,
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

  } else {
    if (dropMarker) dropMarker.setMap(null);

    dropMarker = new google.maps.Marker({
      map,
      position: loc,
      draggable: true,
      label: "D"
    });

    marker = dropMarker;
  }

  /* Drag reposition */
  marker.addListener("dragend", () => {
    updateAddressFromMarker(type, marker.getPosition());
  });

  /* Tap map reposition */
  map.addListener("click", function (event) {
    marker.setPosition(event.latLng);
    updateAddressFromMarker(type, event.latLng);
  });

  adjustBounds();
}

/* =============================
   UPDATE ADDRESS AFTER DRAG
============================= */
function updateAddressFromMarker(type, latlng) {

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
    }
  });
}

/* =============================
   FIT MAP TO BOTH PINS
============================= */
function adjustBounds() {

  if (!map) return;

  const bounds = new google.maps.LatLngBounds();

  if (pickupPlace)
    bounds.extend(pickupPlace.geometry.location);

  if (dropPlace)
    bounds.extend(dropPlace.geometry.location);

  if (!bounds.isEmpty())
    map.fitBounds(bounds);
}

/* =============================
   QUOTE CALCULATION
============================= */
function calculateQuote() {

  const shiftDate = document.getElementById("shiftDate").value;
  const shiftTime = document.getElementById("shiftTime").value;

  const houseBase =
    parseInt(document.getElementById("house").value || 0);
  const vehicleRate =
    parseFloat(document.getElementById("vehicle").value || 0);

  if (!shiftDate || !shiftTime || !houseBase || !vehicleRate) {
    alert("Fill required fields");
    return;
  }

  const pickupText =
    document.getElementById("pickup").value.trim();
  const dropText =
    document.getElementById("drop").value.trim();

  if (!pickupText || !dropText) {
    alert("Enter locations");
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
  }, (res, status) => {

    if (status !== "OK") {
      alert("Distance error");
      return;
    }

    const km =
      res.rows[0].elements[0].distance.value / 1000;

    const total =
      MIN_BASE_PRICE +
      houseBase +
      km * vehicleRate +
      furnitureCost;

    document.getElementById("result").innerHTML = `
  Distance: ${km.toFixed(1)} km<br>
  Base: ₹${MIN_BASE_PRICE}<br>
  House: ₹${houseBase}<br>
  Distance Cost: ₹${Math.round(km * vehicleRate)}<br>
  Furniture: ₹${furnitureCost}<br><br>
  <strong>Total: ₹${Math.round(total)}</strong>
`;
  });
}

/* =============================
   WHATSAPP BOOKING
============================= */
function bookOnWhatsApp() {

  const message =
    "New Moving Request 🚚\n\n" +
    document.getElementById("result").innerText;

  window.location.href =
    `https://wa.me/917996062921?text=${encodeURIComponent(message)}`;
}
