let pickupPlace = null;
let dropPlace = null;

let directionsService;
let directionsRenderer;

let map;
let pickupMarker = null;
let dropMarker = null;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

/* ---------- INIT ---------- */
function initAutocomplete() {

  const pickupInput = document.getElementById("pickup");
  const dropInput = document.getElementById("drop");

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

  currentLocationCheck.addEventListener("change", function () {
    if (this.checked) {
      useCurrentLocation();
    } else {
      pickup.value = "";
      pickupPlace = null;
      if (pickupMarker) pickupMarker.setMap(null);
    }
  });

  attachAutoCalculation();
}

/* ---------- AUTO CALC LISTENERS ---------- */
function attachAutoCalculation() {

  const fields = [
    house, vehicle,
    sofaCheck, sofaType, sofaQty,
    bedCheck, bedType, bedQty,
    fridgeCheck,
    wmCheck, wmType
  ];

  fields.forEach(el => {
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
      if (status === "OK") {

        pickup.value = res[0].formatted_address;

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
    if (status === "OK") {

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

    calculateQuote(true);
  }
}

/* ---------- QUOTE ---------- */
function calculateQuote(auto = false) {

  const houseBase = Number(house.value || 0);
  const vehicleRate = Number(vehicle.value || 0);

  if (!pickup.value || !drop.value ||
      !houseBase || !vehicleRate) {
    if (!auto) alert("Fill required fields");
    return;
  }

  let furnitureCost = 0;

  if (sofaCheck.checked)
    furnitureCost +=
      Number(sofaType.value) *
      Number(sofaQty.value);

  if (bedCheck.checked)
    furnitureCost +=
      Number(bedType.value) *
      Number(bedQty.value);

  if (fridgeCheck.checked)
    furnitureCost += FRIDGE_PRICE;

  if (wmCheck.checked)
    furnitureCost += Number(wmType.value);

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

    result.innerHTML = `
Distance: ${km.toFixed(1)} km<br>
Furniture: ₹${furnitureCost}<br>
<strong>Total: ₹${Math.round(total)}</strong>`;
  });
}

/* ---------- BOOKING ---------- */
function bookOnWhatsApp() {

  const message =
    "New Moving Request 🚚\n\n" +
    result.innerText;

  window.location.href =
    `https://wa.me/919742700167?text=${encodeURIComponent(message)}`;
}
