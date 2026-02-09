let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;

const MIN_BASE_PRICE = 1100;

/* ===== SAVE LEAD ===== */
function saveLead() {
  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec", {
    method: "POST",
    body: JSON.stringify({
      name: custName?.value || "",
      phone: custPhone?.value || "",
      pickup: pickup?.value || "",
      drop: drop?.value || ""
    })
  });
}

/* ===== INIT ===== */
function initAutocomplete(){
  const pickupAuto =
    new google.maps.places.Autocomplete(pickup);

  const dropAuto =
    new google.maps.places.Autocomplete(drop);

  pickupAuto.addListener("place_changed",()=>{
    pickupPlace = pickupAuto.getPlace();
    showLocation("pickup");
  });

  dropAuto.addListener("place_changed",()=>{
    dropPlace = dropAuto.getPlace();
    showLocation("drop");
  });

  useCurrentLocation.addEventListener("change",()=>{
    if(!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(pos=>{
      const loc={
        lat:pos.coords.latitude,
        lng:pos.coords.longitude
      };

      const geo=new google.maps.Geocoder();
      geo.geocode({location:loc},(res)=>{
        pickup.value=res[0].formatted_address;
        pickupPlace={geometry:{location:loc}};
        showLocation("pickup");
      });
    });
  });
}

/* ===== MAP DISPLAY ===== */
function showLocation(type){

  const mapDiv=document.getElementById("map");

  const loc=(type==="pickup"
    ? pickupPlace
    : dropPlace)?.geometry?.location;

  if(!loc) return;

  if(!map){
    map=new google.maps.Map(mapDiv,{
      center:loc,
      zoom:14
    });

    directionsService=
      new google.maps.DirectionsService();

    directionsRenderer=
      new google.maps.DirectionsRenderer({map});
  }

  map.setCenter(loc);

  if(pickupPlace && dropPlace){
    directionsService.route({
      origin:pickupPlace.geometry.location,
      destination:dropPlace.geometry.location,
      travelMode:"DRIVING"
    },(res,status)=>{
      if(status==="OK")
        directionsRenderer.setDirections(res);
    });
  }
}

/* ===== QUOTE ===== */
function calculateQuote(auto=false){

  if(!pickup.value || !drop.value){
    if(!auto) alert("Enter pickup & drop");
    return;
  }

  let furnitureCost=0;

  if(sofaCheck.checked)
    furnitureCost+=500*Number(sofaQty.value||1);

  if(bedCheck.checked)
    furnitureCost+=700*Number(bedQty.value||1);

  if(fridgeCheck.checked)
    furnitureCost+=400;

  if(wmCheck.checked)
    furnitureCost+=400;

  const houseBase=Number(house.value||0);
  const vehicleRate=Number(vehicle.value||25);

  const service=new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins:[pickup.value],
    destinations:[drop.value],
    travelMode:"DRIVING",
  },(res,status)=>{

    if(status!=="OK") return;

    const km =
      res.rows[0].elements[0]
        .distance.value / 1000;

    const distanceCost = km * vehicleRate;

    const total =
      MIN_BASE_PRICE +
      houseBase +
      distanceCost +
      furnitureCost;

    document.getElementById("result").innerHTML = `
<h3>Estimated Price</h3>
Distance: ${km.toFixed(1)} km<br>
Base: ₹${MIN_BASE_PRICE}<br>
House: ₹${houseBase}<br>
Distance Cost: ₹${Math.round(distanceCost)}<br>
Furniture: ₹${furnitureCost}<br>
<strong>Total Estimate: ₹${Math.round(total)}</strong>
`;
  });
}

/* ===== BOOKING ===== */
function bookOnWhatsApp(){

  calculateQuote(true);
  saveLead();

  const message =
    "New Moving Request 🚚\n\n" +
    document.getElementById("result").innerText;

  window.location.href =
    `https://wa.me/919945095453?text=${encodeURIComponent(message)}`;
}

/* ===== STEP FORM ===== */
let currentStep=0;

const steps=document.querySelectorAll(".form-step");

function showStep(n){
  steps.forEach(step =>
    step.classList.remove("active"));

  steps[n].classList.add("active");

  document.getElementById("progressBar").style.width =
    ((n+1)/steps.length)*100+"%";

  if(n===steps.length-1)
    calculateQuote(true);
}

function nextStep(){
  if(currentStep<steps.length-1){
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep(){
  if(currentStep>0){
    currentStep--;
    showStep(currentStep);
  }
}
