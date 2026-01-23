let pickupPlace = null;
let dropPlace = null;

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
  if (!pickupPlace || !dropPlace) {
    alert("Please select pickup and drop from Google suggestions");
    return;
  }

  const shiftDate = document.getElementById("shiftDate").value;
  const shiftTime = document.getElementById("shiftTime").value;

  if (!shiftDate || !shiftTime) {
    alert("Please select shifting date and time");
    return;
  }

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
      const distanceCost = distanceKm * parseFloat(vehicleRate);
      const houseCost = parseInt(houseBase);

      let furnitureCost = 0;

      if (document.getElementById("sofaCheck").checked) {
        furnitureCost +=
          parseInt(document.getElementById("sofaType").value) *
          parseInt(document.getElementById("sofaQty").value || 1);
      }

      if (document.getElementById("bedCheck").checked) {
        furnitureCost +=
          parseInt(document.getElementById("bedType").value) *
          parseInt(document.getElementById("bedQty").value || 1);
      }

      if (document.getElementById("fridgeCheck").checked) {
        furnitureCost += parseInt(document.getElementById("fridgeType").value);
      }

      if (document.getElementById("wmCheck").checked) {
        furnitureCost += parseInt(document.getElementById("wmType").value);
      }

      const total =
        MIN_BASE_PRICE +
        houseCost +
        distanceCost +
        furnitureCost;

      document.getElementById("result").innerHTML = `
        <strong>Shifting Summary</strong><br>
        Date: ${shiftDate}<br>
        Time: ${shiftTime}<br><br>

        Distance: ${distanceKm.toFixed(1)} km<br>
        Base Price: ₹${MIN_BASE_PRICE}<br>
        House Cost: ₹${houseCost}<br>
        Distance Cost: ₹${Math.round(distanceCost)}<br>
        Furniture Cost: ₹${furnitureCost}<br><br>

        <strong>Total Cost: ₹${Math.round(total)}</strong>
      `;
    }
  );
}
