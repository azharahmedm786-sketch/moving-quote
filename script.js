let pickupPlace = null;
let dropPlace = null;

// minimum base charge
const MIN_BASE_PRICE = 1100;

function initAutocomplete() {
  const pickupInput = document.getElementById("pickup");
  const dropInput = document.getElementById("drop");

  const options = {
    componentRestrictions: { country: "in" },
    fields: ["formatted_address", "geometry"]
  };

  const pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
  const dropAutocomplete = new google.maps.places.Autocomplete(dropInput, options);

  pickupAutocomplete.addListener("place_changed", () => {
    pickupPlace = pickupAutocomplete.getPlace();
  });

  dropAutocomplete.addListener("place_changed", () => {
    dropPlace = dropAutocomplete.getPlace();
  });
}

function calculateQuote() {
  // address validation
  if (!pickupPlace || !dropPlace) {
    alert("Please select pickup and drop from Google suggestions");
    return;
  }

  // date & time validation
  const shiftDate = document.getElementById("shiftDate").value;
  const shiftTime = document.getElementById("shiftTime").value;

  if (!shiftDate || !shiftTime) {
    alert("Please select shifting date and time");
    return;
  }

  // house & vehicle
  const houseBase = document.getElementById("house").value;
  const vehicleRate = document.getElementById("vehicle").value;

  if (!houseBase || !vehicleRate) {
    alert("Please select house type and vehicle");
    return;
  }

  const service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix(
    {
      origins: [pickupPlace.formatted_address],
      destinations: [dropPlace.formatted_address],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC
    },
    (response, status) => {
      if (status !== "OK") {
        alert("Distance service error");
        return;
      }

      const element = response.rows[0].elements[0];
      if (element.status !== "OK") {
        alert("Route not found");
        return;
      }

      const distanceKm = element.distance.value / 1000;

      // cost calculations
      const distanceCost = distanceKm * parseFloat(vehicleRate);
      const houseCost = parseInt(houseBase);

      let furnitureCost = 0;
      document.querySelectorAll(".item:checked").forEach(item => {
        furnitureCost += parseInt(item.value);
      });

      const total =
        MIN_BASE_PRICE +
        houseCost +
        distanceCost +
        furnitureCost;
