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

  /* Correct validation */
  if (!shiftDate || !shiftTime || houseValue === "" || vehicleValue === "") {
    alert("Please fill all required fields");
    return;
  }

  const houseBase = parseInt(houseValue);
  const vehicleRate = parseFloat(vehicleValue);

  /* Location fallback */
  const pickupText =
    document.getElementById("pickup").value.trim();
  const dropText =
    document.getElementById("drop").value.trim();

  if (!pickupText || !dropText) {
    alert("Please enter pickup and drop locations");
    return;
  }

  /* =============================
     Furniture Cost Calculation
  ============================= */
  let furnitureCost = 0;

  if (document.getElementById("sofaCheck").checked) {
    const sofaType =
      parseInt(document.getElementById("sofaType").value || 0);
    const sofaQty =
      parseInt(document.getElementById("sofaQty").value || 1);
    furnitureCost += sofaType * sofaQty;
  }

  if (document.getElementById("bedCheck").checked) {
    const bedType =
      parseInt(document.getElementById("bedType").value || 0);
    const bedQty =
      parseInt(document.getElementById("bedQty").value || 1);
    furnitureCost += bedType * bedQty;
  }

  if (document.getElementById("fridgeCheck").checked) {
    furnitureCost += FRIDGE_PRICE;
  }

  if (document.getElementById("wmCheck").checked) {
    const wmType =
      parseInt(document.getElementById("wmType").value || 0);
    furnitureCost += wmType;
  }

  /* =============================
     Distance Calculation
  ============================= */
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
