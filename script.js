let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

/* ---------- SAVE LEAD ---------- */
function saveLead(){
  fetch("https://script.google.com/macros/s/AKfycbwne_QGsKg2vomV1ELPCNkJQ--vMUx4qbkKxfHPvMT9zjkduNZ3t7AC5XC-lNnskEzwVg/exec",{
    method:"POST",
    body:JSON.stringify({
      name:custName?.value||"",
      phone:custPhone?.value||"",
      pickup:pickup?.value||"",
      drop:drop?.value||""
    })
  });
}

/* ---------- INIT MAP + AUTOCOMPLETE ---------- */
function initAutocomplete(){

  const pickupAuto =
    new google.maps.places.Autocomplete(pickup);

  const dropAuto =
    new google.maps.places.Autocomplete(drop);

  pickupAuto.addListener("place_changed",()=>{
    pickupPlace = pickupAuto.getPlace();
    showLocation("pickup");
    calculateQuote(true);
  });

  dropAuto.addListener("place_changed",()=>{
    dropPlace = dropAuto.getPlace();
    showLocation("drop");
    calculateQuote(true);
  });

  useCurrentLocation.addEventListener("change",()=>{
    if(!useCurrentLocation.checked) return;

    navigator.geolocation.getCurrentPosition(pos=>{
      const loc={
        lat:pos.coords.latitude,
        lng:pos.coords.longitude
      };

      const geo=new google.maps.Geocoder();

      geo.geocode({location:loc},(res,status)=>{
        if(status==="OK"){
          pickup.value=res[0].formatted_address;
          pickupPlace={geometry:{location:loc}};
          showLocation("pickup");
          calculateQuote(true);
        }
      });
    });
  });

  attachAutoCalculation();
}

/* ---------- AUTO PRICE UPDATE ---------- */
function attachAutoCalculation(){
  [
    house,vehicle,
    sofaCheck,sofaQty,
    bedCheck,bedQty,
    fridgeCheck,wmCheck
  ].forEach(el=>{
    if(!el) return;
    el.addEventListener("change",
      ()=>calculateQuote(true));
  });
}

/* ---------- MAP ---------- */
function showLocation(type){

  const place =
    type==="pickup"?pickupPlace:dropPlace;

  if(!place?.geometry) return;

  const loc=place.geometry.location;

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

/* ---------- QUOTE ---------- */
function calculateQuote(auto=false){

  if(!pickup.value||!drop.value){
    if(!auto) alert("Enter locations");
    return;
  }

  const houseBase=Number(house.value||0);
  const vehicleRate=Number(vehicle.value||0);

  if(!houseBase||!vehicleRate){
    if(!auto) alert("Select house & vehicle");
    return;
  }

  let furnitureCost=0;

  if(sofaCheck.checked)
    furnitureCost+=500*Number(sofaQty.value||1);

  if(bedCheck.checked)
    furnitureCost+=700*Number(bedQty.value||1);

  if(fridgeCheck.checked)
    furnitureCost+=FRIDGE_PRICE;

  if(wmCheck.checked)
    furnitureCost+=400;

  const service =
    new google.maps.DistanceMatrixService();

  service.getDistanceMatrix({
    origins:[pickup.value],
    destinations:[drop.value],
    travelMode:"DRIVING"
  },(res,status)=>{

    if(status!=="OK") return;

    const km =
      res.rows[0].elements[0].distance.value/1000;

    const distanceCost = km*vehicleRate;

    const total =
      MIN_BASE_PRICE+
      houseBase+
      distanceCost+
      furnitureCost;

    result.innerHTML=`
<h3>Estimated Price</h3>
Distance: ${km.toFixed(1)} km<br>
Furniture: ₹${furnitureCost}<br>
<strong>Total Estimate: ₹${Math.round(total)}</strong>`;
  });
}

/* ---------- BOOK ---------- */
function bookOnWhatsApp(){

  calculateQuote(true);
  saveLead();

  alert("✅ Booking request sent!");

  const message =
    "New Moving Request 🚚\n\n"+
    result.innerText;

  window.location.href =
    `https://wa.me/919945095453?text=${encodeURIComponent(message)}`;
}

/* ---------- STEP FORM ---------- */
let currentStep=0;
const steps=document.querySelectorAll(".form-step");

function showStep(n){
  steps.forEach(s=>s.classList.remove("active"));
  steps[n].classList.add("active");

  progressBar.style.width =
    ((n+1)/steps.length)*100+"%";

  if(n===steps.length-1)
    calculateQuote(true);
}

function nextStep(){

  if(currentStep===0 &&
     (!pickup.value||!drop.value)){
    alert("Enter pickup & drop");
    return;
  }

  if(currentStep===1 &&
     (!house.value||!vehicle.value)){
    alert("Select house & vehicle");
    return;
  }

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
function attachAutoPriceUpdate() {

  const fields = [
    pickup, drop,
    house, vehicle,
    sofaCheck, sofaQty,
    bedCheck, bedQty,
    fridgeCheck, wmCheck
  ];

  fields.forEach(el => {
    if (!el) return;

    el.addEventListener("change", () => {
      calculateQuote(true);
    });
  });
}

window.addEventListener("load", attachAutoPriceUpdate);
