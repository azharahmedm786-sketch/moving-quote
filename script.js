let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;

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
    calculateQuote(true);
  });

  dropAuto.addListener("place_changed", () => {
    dropPlace = dropAuto.getPlace();
    showLocation();
    calculateQuote(true);
  });
}

/* ---------- MAP ROUTE ---------- */
function showLocation() {

  if (!pickupPlace?.geometry ||
      !dropPlace?.geometry) return;

  const loc = pickupPlace.geometry.location;

  const mapDiv = document.getElementById("map");

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: loc,
      zoom: 14
    });

    directionsService =
      new google.maps.DirectionsService();

    directionsRenderer =
      new google.maps.DirectionsRenderer({ map });
  }

  directionsService.route({
    origin: pickupPlace.geometry.location,
    destination: dropPlace.geometry.location,
    travelMode: "DRIVING"
  }, (res, status) => {
    if (status === "OK")
      directionsRenderer.setDirections(res);
  });
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
<strong>Total Estimate: ₹${Math.round(total)}</strong>`;

    livePrice.innerText =
      "₹" + Math.round(total);

    /* Save last quote */
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

  }, 700);
}
