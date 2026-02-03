let pickupPlace = null;
let dropPlace = null;

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
  });

  dropAutocomplete.addListener("place_changed", () => {
    dropPlace = dropAutocomplete.getPlace();
  });
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

  if (document.getElementById("sofaCheck").checked) {
    furnitureCost +=
      parseInt(document.getElementById("sofaType").value || 0) *
      parseInt(document.getElementById("sofaQty").value || 1);
  }

  if (document.getElementById("bedCheck").checked) {
    furnitureCost +=
      parseInt(document.getElementById("bedType").value || 0) *
      parseInt(document.getElementById("bedQty").value || 1);
  }

  if (document.getElementById("fridgeCheck").checked) {
    furnitureCost += FRIDGE_PRICE;
  }

  if (document.getElementById("wmCheck").checked) {
    furnitureCost +=
      parseInt(document.getElementById("wmType").value || 0);
  }

  const service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix(
    {
      origins: [pickupText],
      destinations: [dropText],
      travelMode: "DRIVING",
      unitSystem: google.maps.UnitSystem.METRIC
    },
    (response, status) => {

      if (
        status !== "OK" ||
        response.rows[0].elements[0].status !== "OK"
      ) {
        alert("Distance calculation failed");
        return;
      }

      const distanceMeters =
        response.rows[0].elements[0].distance.value;

      const distanceKm = distanceMeters / 1000;
      const distanceCost = distanceKm * vehicleRate;

      const total =
        MIN_BASE_PRICE +
        houseBase +
        distanceCost +
        furnitureCost;

      document.getElementById("result").innerHTML = `
        Estimated Distance: ${distanceKm.toFixed(1)} km<br>
        Base: ₹${MIN_BASE_PRICE}<br>
        House: ₹${houseBase}<br>
        Distance: ₹${Math.round(distanceCost)}<br>
        Furniture: ₹${furnitureCost}<br><br>
        <strong>Total: ₹${Math.round(total)}</strong>
      `;
    }
  );
}

/* =============================
   WHATSAPP BOOKING
============================= */
function bookOnWhatsApp() {

  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();

  if (!name || !phone) {
    alert("Please enter name and phone number");
    return;
  }

  const message =
    `New Moving Request 🚚\n\nCustomer: ${name}\nPhone: ${phone}\n\n` +
    document.getElementById("result").innerText;

  window.location.href =
    `https://wa.me/917996062921?text=${encodeURIComponent(message)}`;
}

/* =============================
   MAP PIN LOCATION FEATURE
============================= */
let map;
let marker;
let activeField = null;

function openMap(field) {
  activeField = field;

  const mapDiv = document.getElementById("map");
  mapDiv.style.display = "block";

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: { lat: 12.9716, lng: 77.5946 },
      zoom: 13,
    });

    map.addListener("click", function (event) {
      placeMarker(event.latLng);
      getAddress(event.latLng);
    });
  }

  /* Mobile resize fix */
  setTimeout(() => {
    google.maps.event.trigger(map, "resize");
    map.setCenter({ lat: 12.9716, lng: 77.5946 });
  }, 300);
}

function placeMarker(location) {
  if (marker) marker.setMap(null);

  marker = new google.maps.Marker({
    position: location,
    map: map,
  });
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
