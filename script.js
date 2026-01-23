let pickupAutocomplete, dropAutocomplete;

function initAutocomplete() {
  pickupAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("pickup"),
    { componentRestrictions: { country: "in" } }
  );

  dropAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("drop"),
    { componentRestrictions: { country: "in" } }
  );
}

window.onload = initAutocomplete;

function calculateQuote() {
  let pickup = document.getElementById("pickup").value;
  let drop = document.getElementById("drop").value;
  let vehicleRate = document.getElementById("vehicle").value;

  if (!pickup || !drop || !vehicleRate) {
    alert("Please enter pickup, drop and vehicle");
    return;
  }

  let service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix(
    {
      origins: [pickup],
      destinations: [drop],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC
    },
    function (response, status) {
      if (status !== "OK") {
        alert("Distance service error");
        return;
      }

      let element = response.rows[0].elements[0];

      if (element.status !== "OK") {
        alert("Route not found");
        return;
      }

      let distanceKm = element.distance.value / 1000;
      let vehicleCost = distanceKm * parseFloat(vehicleRate);

      let itemCost = 0;
      document.querySelectorAll(".item:checked").forEach(item => {
        itemCost += parseInt(item.value);
      });

      let total = Math.round(vehicleCost + itemCost);

      document.getElementById("result").innerHTML =
        `Distance: ${distanceKm.toFixed(1)} km<br><strong>Total Cost: ₹${total}</strong>`;
    }
  );
}


      document.getElementById("result").innerHTML =
        `Distance: ${distanceKm.toFixed(1)} km<br><strong>Total Cost: ₹${total}</strong>`;
    }
  );
}
