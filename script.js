function calculateQuote() {
  let pickup = document.getElementById("pickup").value;
  let drop = document.getElementById("drop").value;
  let vehicleRate = document.getElementById("vehicle").value;

  if (pickup === "" || drop === "" || vehicleRate === "") {
    alert("Please select all fields");
    return;
  }

  let km = 10; // temporary fixed distance

  let vehicleCost = km * vehicleRate;

  let items = document.querySelectorAll(".item:checked");
  let itemCost = 0;
  items.forEach(item => itemCost += parseInt(item.value));

  let total = vehicleCost + itemCost;

  document.getElementById("result").innerHTML =
    "Estimated Distance: " + km + " km<br>Total Cost: ₹" + total;
}

