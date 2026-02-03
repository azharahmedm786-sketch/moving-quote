let pickupPlace = null;
let dropPlace = null;

let map;
let pickupMarker = null;
let dropMarker = null;
let activeField = null;

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
   CURRENT LOCATION DETECT
============================= */
function detectCurrentLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(position => {
    const loc = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };

    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ location: loc }, (results, status) => {
      if (status === "OK" && results[0]) {
        document.getElementById("pickup").value =
          results[0].formatted_address;

        pickupPlace = {
          geometry: { location: loc }
        };

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
      zoom: 15,
    });
  }

  map.setCenter(loc);

  let markerObj;

  if (type === "pickup") {
    if (pickupMarker) pickupMarker.setMap(null);

    pickupMarker = new google.maps.Marker({
      map: map,
      position: loc,
      draggable: true,
      label: "P"
    });

    markerObj = pickupMarker;
  } else {
    if (dropMarker) dropMarker.setMap(null);

    dropMarker = new google.maps.Marker({
      map: map,
      position: loc,
      draggable: true,
      label: "D"
    });

    markerObj = dropMarker;
  }

  markerObj.addListener("dragend", function () {
    updateAddressFromMarker(type, markerObj.getPosition());
  });

  adjustBounds();
}

/* =============================
   UPDATE ADDRESS AFTER DRAG
============================= */
function updateAddressFromMarker(type, latlng) {
  const geocoder = new google.maps.Geocoder();

  geocoder.geocode({ location: latlng }, (results, status) => {
    if (status === "OK" && results[0]) {
      document.getElementById(type).value =
        results[0].formatted_address;

      if (type === "pickup")
        pickupPlace = { geometry: { location: latlng } };
      else
        dropPlace = { geometry: { location: latlng } };

      adjustBounds();
    }
  });
}

/* =============================
   FIT MAP TO BOTH LOCATIONS
============================= */
function adjustBounds() {
  if (!pickupPlace || !dropPlace) return;

  const bounds = new google.maps.LatLngBounds();
  bounds.extend(pickupPlace.geometry.location);
  bounds.extend(dropPlace.geometry.location);

  map.fitBounds(bounds);
}

/* =============================
   QUOTE CALCULATION
============================= */
function calculateQuote() {

  const shiftDate = shiftDateInput.value;
  const shiftTime = shiftTimeInput.value;

  const houseBase = parseInt(house.value || 0);
  const vehicleRate = parseFloat(vehicle.value || 0);

  if (!shiftDate || !shiftTime || !houseBase || !vehicleRate) {
    alert("Please fill all required fields");
    return;
  }

  const pickupText = pickup.value.trim();
  const dropText = drop.value.trim();

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

    const total =
      MIN_BASE_PRICE +
      houseBase +
      km * vehicleRate +
      furnitureCost;

    result.innerHTML = `
      Distance: ${km.toFixed(1)} km<br>
      Total: ₹${Math.round(total)}
    `;
  });
}

/* =============================
   WHATSAPP BOOKING
============================= */
function bookOnWhatsApp() {
  const message =
    `New Moving Request 🚚\n\n` +
    result.innerText;

  window.location.href =
    `https://wa.me/917996062921?text=${encodeURIComponent(message)}`;
}
