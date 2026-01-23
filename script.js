let pickupPlace = null;
let dropPlace = null;

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

  const vehicleRate = document.getElementById("vehicle").value;
  if (!vehicleRate) {
    alert("Please select a vehicle");
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
      const vehicleCost = distanceKm * parseFloat(vehicleRate);

      let itemCost = 0;
      document.querySelectorAll(".item:checked").forEach(item => {
        itemCost += parseInt(item.value);
      });

      const total = Math.round(vehicleCost + itemCost);

      document.getElementById("result").innerHTML =
        `Distance: ${distanceKm.toFixed(1)} km<br><strong>Total Cost: ₹${total}</strong>`;
    }
  );
}
