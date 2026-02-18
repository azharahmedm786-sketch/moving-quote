let currentStep=0;
let steps=[];
let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let lastQuoteData=null;

const MIN_BASE_PRICE=1100;

window.addEventListener("load",()=>{
steps=document.querySelectorAll(".form-step");
showStep(0);
});

function showStep(n){
steps.forEach(s=>s.classList.remove("active"));
steps[n].classList.add("active");
document.getElementById("progressBar").style.width=
((n+1)/steps.length)*100+"%";
}

function nextStep(){
currentStep++;
showStep(currentStep);
}

function prevStep(){
currentStep--;
showStep(currentStep);
}

/* OTP DEMO */
function sendOTP(){
alert("Demo OTP: 1234");
document.getElementById("otpBox").style.display="block";
}

function verifyOTP(){
if(document.getElementById("otpInput").value=="1234"){
alert("Login Success");
nextStep();
}else alert("Wrong OTP");
}

/* MAP */
function initAutocomplete(){
const pickupAuto=new google.maps.places.Autocomplete(pickup);
const dropAuto=new google.maps.places.Autocomplete(drop);

pickupAuto.addListener("place_changed",()=>{
pickupPlace=pickupAuto.getPlace();
});

dropAuto.addListener("place_changed",()=>{
dropPlace=dropAuto.getPlace();
});
}

/* PRICE */
function calculateQuote(cb){

let service=new google.maps.DistanceMatrixService();

service.getDistanceMatrix({
origins:[pickup.value],
destinations:[drop.value],
travelMode:"DRIVING"
},(res,status)=>{

let km=res.rows[0].elements[0].distance.value/1000;

let house=Number(document.getElementById("house").value);
let vehicle=Number(document.getElementById("vehicle").value);

let inventoryCost=0;
let list=[];

document.querySelectorAll(".inv").forEach(c=>{
if(c.checked){
let qty=document.querySelector(
`.qty[data-name="${c.dataset.name}"]`
).value;

inventoryCost+=300*qty;
list.push(c.dataset.name+" x"+qty);
}
});

let total=MIN_BASE_PRICE+house+(km*vehicle)+inventoryCost;

lastQuoteData={
distance:km.toFixed(1),
total:Math.round(total),
items:list.join(", ")
};

result.innerHTML=
`Distance: ${km.toFixed(1)} km<br>
Items: ${list.join(", ")}<br>
Total: ₹${Math.round(total)}`;

if(cb)cb();
});
}

/* BOOKING */
function bookOnWhatsApp(){

calculateQuote(()=>{

let id="PZ"+Date.now().toString().slice(-6);

fetch("YOUR_GOOGLE_SCRIPT_URL",{
method:"POST",
body:JSON.stringify({
booking:id,
pickup:pickup.value,
drop:drop.value,
distance:lastQuoteData.distance,
items:lastQuoteData.items,
total:lastQuoteData.total
})
});

let msg=`Booking ID: ${id}
Pickup: ${pickup.value}
Drop: ${drop.value}
Distance: ${lastQuoteData.distance} km
Items: ${lastQuoteData.items}
Total: ₹${lastQuoteData.total}`;

window.open(
"https://wa.me/919945095453?text="+encodeURIComponent(msg)
);
});
}
