let pickupPlace = null;
let dropPlace = null;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

/* AUTOCOMPLETE */
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

/* QUOTE CALCULATION */
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

  const pickupText = document.getElementById("pickup").value.trim();
  const dropText = document.getElementById("drop").value.trim();

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

/* WHATSAPP BOOKING */
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

/* MAP PIN FEATURE */
let map, marker, activeField;

function openMap(field) {
  activeField = field;
  document.getElementById("map").style.display = "block";

  if (!map) {
    map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: 12.9716, lng: 77.5946 },
      zoom: 13,
    });

    map.addListener("click", (event) => {
      placeMarker(event.latLng);
      getAddress(event.latLng);
    });
  }
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
    if (status === "OK") {
      document.getElementById(activeField).value =
        results[0].formatted_address;
    }
  });
}
