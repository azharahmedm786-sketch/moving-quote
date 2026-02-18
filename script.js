let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;

const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

let lastQuoteData = null;

/* Booking ID */
function generateBookingID(){
return "PZ"+Date.now().toString().slice(-6);
}

/* Save Lead */
function saveLead(data){
fetch("YOUR_GOOGLE_SHEET_URL",{
method:"POST",
body:JSON.stringify(data)
});
}

/* Maps init */
function initAutocomplete(){

const pickupInput=document.getElementById("pickup");
const dropInput=document.getElementById("drop");

const pickupAuto=new google.maps.places.Autocomplete(pickupInput);
const dropAuto=new google.maps.places.Autocomplete(dropInput);

pickupAuto.addListener("place_changed",()=>{
pickupPlace=pickupAuto.getPlace();
showLocation("pickup");
calculateQuote(true);
});

dropAuto.addListener("place_changed",()=>{
dropPlace=dropAuto.getPlace();
showLocation("drop");
calculateQuote(true);
});
}

/* Map display */
function showLocation(type){

const place=(type==="pickup")?pickupPlace:dropPlace;
if(!place?.geometry)return;

const loc=place.geometry.location;
const mapDiv=document.getElementById("map");

if(!map){
map=new google.maps.Map(mapDiv,{center:loc,zoom:14});
directionsService=new google.maps.DirectionsService();
directionsRenderer=new google.maps.DirectionsRenderer({map});
}

map.setCenter(loc);

if(pickupPlace && dropPlace){
directionsService.route({
origin:pickupPlace.geometry.location,
destination:dropPlace.geometry.location,
travelMode:"DRIVING"
},(res,status)=>{
if(status==="OK")directionsRenderer.setDirections(res);
});
}
}

/* Price calc */
function calculateQuote(auto=false){

if(!pickup.value||!drop.value)return;

const houseBase=Number(house.value||0);
const vehicleRate=Number(vehicle.value||0);

if(!houseBase||!vehicleRate)return;

let furnitureCost=0;
let furnitureList=[];

if(sofaCheck.checked){
const qty=Number(sofaQty.value||1);
furnitureCost+=500*qty;
furnitureList.push("Sofa x"+qty);
}

if(bedCheck.checked){
const qty=Number(bedQty.value||1);
furnitureCost+=700*qty;
furnitureList.push("Bed x"+qty);
}

if(fridgeCheck.checked){
furnitureCost+=FRIDGE_PRICE;
furnitureList.push("Fridge");
}

if(wmCheck.checked){
furnitureCost+=400;
furnitureList.push("Washing Machine");
}

if(wardrobeCheck.checked){
furnitureCost+=600;
furnitureList.push("Wardrobe");
}

if(tableCheck.checked){
furnitureCost+=300;
furnitureList.push("Table");
}

const service=new google.maps.DistanceMatrixService();

service.getDistanceMatrix({
origins:[pickup.value],
destinations:[drop.value],
travelMode:"DRIVING"
},(res,status)=>{

if(status!=="OK")return;

const km=res.rows[0].elements[0].distance.value/1000;
const distanceCost=km*vehicleRate;

const total=MIN_BASE_PRICE+houseBase+distanceCost+furnitureCost;

livePrice.innerText="₹"+Math.round(total);

result.innerHTML=
`Distance: ${km.toFixed(1)} km<br>
Furniture: ₹${furnitureCost}<br>
Total: ₹${Math.round(total)}`;

lastQuoteData={
distance:km.toFixed(1),
total:Math.round(total),
furniture:furnitureList.join(", ")
};
});
}

/* Booking */
function bookOnWhatsApp(){

calculateQuote(true);

setTimeout(()=>{
if(!lastQuoteData)return;

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
encodeURIComponent("Booking "+bookingID),
"_blank");
},500);
}

/* Inventory PDF */
function generateInventoryPDF(){

if(!lastQuoteData){
alert("Calculate price first");
return;
}

const { jsPDF } = window.jspdf;
const doc=new jsPDF();

doc.text("PackZen Packers & Movers",20,20);
doc.text("Inventory List",20,30);

doc.text("Customer: "+custName.value,20,50);
doc.text("Phone: "+custPhone.value,20,60);
doc.text("Pickup: "+pickup.value,20,70);
doc.text("Drop: "+drop.value,20,80);

doc.text("Furniture:",20,100);
doc.text(lastQuoteData.furniture,20,110);

doc.text("Total Estimate: ₹"+lastQuoteData.total,20,130);

doc.save("inventory.pdf");
}

/* Step navigation */
let currentStep=0;
let steps=[];

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
