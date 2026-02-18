let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;
let lastQuoteData = null;

/* BOOKING ID */
function generateBookingID(){
 return "PZ"+Date.now().toString().slice(-6);
}

/* SAVE LEAD */
function saveLead(data){
 fetch("YOUR_GOOGLE_SCRIPT_URL",{
  method:"POST",
  body:JSON.stringify(data)
 });
}

/* MAP INIT */
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

 setupCurrentLocation();
}

/* CURRENT LOCATION */
function setupCurrentLocation(){
 useCurrentLocation.addEventListener("change",()=>{
  navigator.geolocation.getCurrentPosition(pos=>{
   const loc={
    lat:pos.coords.latitude,
    lng:pos.coords.longitude
   };
   pickup.value="Current Location";
   pickupPlace={geometry:{location:loc}};
   showLocation("pickup");
  });
 });
}

/* SHOW LOCATION */
function showLocation(type){
 const place = type==="pickup"?pickupPlace:dropPlace;
 if(!place?.geometry) return;

 const loc = place.geometry.location;

 if(!map){
  map=new google.maps.Map(map,{
   center:loc,zoom:14
  });

  directionsService=new google.maps.DirectionsService();
  directionsRenderer=new google.maps.DirectionsRenderer({
   map,suppressMarkers:true
  });
 }

 let marker;

 if(type==="pickup"){
  if(pickupMarker) pickupMarker.setMap(null);
  pickupMarker=new google.maps.Marker({map,position:loc,draggable:true,label:"P"});
  marker=pickupMarker;
 }

 if(type==="drop"){
  if(dropMarker) dropMarker.setMap(null);
  dropMarker=new google.maps.Marker({map,position:loc,draggable:true,label:"D"});
  marker=dropMarker;
 }

 marker.addListener("dragend",()=>calculateQuote(true));

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

 calculateQuote(true);
}

/* PRICE CALC */
function calculateQuote(auto=false){

 if(!pickup.value||!drop.value) return;

 const houseBase=Number(house.value||0);
 const vehicleRate=Number(vehicle.value||0);

 if(!houseBase||!vehicleRate) return;

 let furnitureCost=0;
 let list=[];

 if(sofaCheck.checked){
  furnitureCost+=500*Number(sofaQty.value||1);
  list.push("Sofa");
 }

 if(bedCheck.checked){
  furnitureCost+=700*Number(bedQty.value||1);
  list.push("Bed");
 }

 if(fridgeCheck.checked){
  furnitureCost+=FRIDGE_PRICE;
  list.push("Fridge");
 }

 const service=new google.maps.DistanceMatrixService();

 service.getDistanceMatrix({
  origins:[pickup.value],
  destinations:[drop.value],
  travelMode:"DRIVING"
 },(res,status)=>{

  if(status!=="OK") return;

  const km=res.rows[0].elements[0].distance.value/1000;
  const total =
   MIN_BASE_PRICE +
   houseBase +
   km*vehicleRate +
   furnitureCost;

  livePrice.innerText=Math.round(total);

  result.innerHTML =
   `Distance: ${km.toFixed(1)} km<br>
   Total: ₹${Math.round(total)}`;

  lastQuoteData={
   distance:km.toFixed(1),
   total:Math.round(total),
   furniture:list.join(", ")
  };
 });
}

/* OTP */
function sendOTP(){
 window.generatedOTP="1234";
 alert("Demo OTP: 1234");
 otpBox.style.display="block";
}

function verifyOTP(){
 if(otpInput.value===window.generatedOTP)
  alert("Login successful");
 else alert("Wrong OTP");
}

/* BOOKING */
function bookOnWhatsApp(){

 calculateQuote(true);

 setTimeout(()=>{
  if(!lastQuoteData){
   alert("Calculate price first");
   return;
  }

  const bookingID=generateBookingID();

  saveLead({
   bookingID,
   name:custName.value,
   phone:custPhone.value,
   pickup:pickup.value,
   drop:drop.value,
   total:lastQuoteData.total
  });

  alert("Booking ID: "+bookingID);

  window.open(
   "https://wa.me/919945095453?text="+
   encodeURIComponent("Booking ID: "+bookingID),
   "_blank"
  );
 },500);
}

/* STEP NAVIGATION */
let currentStep=0;
let steps;

window.onload=()=>{
 steps=document.querySelectorAll(".form-step");
 showStep(0);
};

function showStep(n){
 steps.forEach(s=>s.classList.remove("active"));
 steps[n].classList.add("active");
 progressBar.style.width=((n+1)/steps.length)*100+"%";
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
