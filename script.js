function calculateQuote() {
  let pickup = document.getElementById("pickup").value;
  let drop = document.getElementById("drop").value;
  let vehicleRate = document.getElementById("vehicle").value;

  if (!pickup || !drop || !vehicleRate) {
    alert("Please select all fields");
    return;
  }

  let service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins: [pickup + ", Bangalore"],
    destinations: [drop + ", Bangalore"],
    travelMode: "DRIVING",
    unitSystem: google.maps.UnitSystem.METRIC
  }, function (response, status) {

    if (status !== "OK") {
      alert("Distance error");
      return;
    }

    let distanceText = response.rows[0].elements[0].distance.text;
    let distanceValue = response.rows[0].elements[0].distance.value / 1000;

    let vehicleCost = distanceValue * vehicleRate;

    let items = document.querySelectorAll(".item:checked");
    let itemCost = 0;
    items.forEach(item => itemCost += parseInt(item.value));

    let total = Math.round(vehicleCost + itemCost);

    document.getElementById("result").innerHTML =
      `Distance: ${distanceText}<br>Total Cost: ₹${total}`;
  });
}
