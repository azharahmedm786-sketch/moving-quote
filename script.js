let pickupPlace = null;
let dropPlace = null;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

function calculateQuote() {
  const shiftDate = document.getElementById("shiftDate").value;
  const shiftTime = document.getElementById("shiftTime").value;
  const houseBase = parseInt(document.getElementById("house").value || 0);
  const vehicleRate = parseFloat(document.getElementById("vehicle").value || 0);

  if (!shiftDate || !shiftTime || !houseBase || !vehicleRate) {
    alert("Please fill all required fields");
    return;
  }

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
    furnitureCost += FRIDGE_PRICE;
  }

  if (document.getElementById("wmCheck").checked) {
    furnitureCost += parseInt(document.getElementById("wmType").value);
  }

  const estimatedDistance = 10; // temporary average
  const distanceCost = estimatedDistance * vehicleRate;

  const total =
    MIN_BASE_PRICE +
    houseBase +
    distanceCost +
    furnitureCost;

  document.getElementById("result").innerHTML = `
    Estimated Distance: ${estimatedDistance} km<br>
    Base: ₹${MIN_BASE_PRICE}<br>
    House: ₹${houseBase}<br>
    Distance: ₹${distanceCost}<br>
    Furniture: ₹${furnitureCost}<br><br>
    <strong>Total: ₹${Math.round(total)}</strong>
  `;
}
