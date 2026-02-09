let pickupPlace, dropPlace;
const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

function initAutocomplete(){
 new google.maps.places.Autocomplete(pickup)
  .addListener("place_changed",()=>pickupPlace=pickup.value);

 new google.maps.places.Autocomplete(drop)
  .addListener("place_changed",()=>dropPlace=drop.value);
}

/* PRICE UPDATE */
function updateLivePrice(total){
 document.getElementById("livePrice")
  .innerText="₹"+Math.round(total);
}

/* CALCULATE */
function calculateQuote(){
 loader.style.display="flex";

 setTimeout(()=>{

  const houseCost=Number(house.value);
  const rate=Number(vehicle.value);

  let furniture=0;
  if(sofaCheck.checked) furniture+=500;
  if(bedCheck.checked) furniture+=700;
  if(fridgeCheck.checked) furniture+=FRIDGE_PRICE;

  const demoDistance=10;
  const distanceCost=demoDistance*rate;

  const total=
   MIN_BASE_PRICE +
   houseCost +
   distanceCost +
   furniture;

  result.innerHTML=
   `Estimated Price: ₹${Math.round(total)}`;

  updateLivePrice(total);

  loader.style.display="none";

 },1000);
}

/* BOOKING */
function bookOnWhatsApp(){
 const msg="New Booking Request\n"+
           result.innerText;

 window.location.href=
 `https://wa.me/919945095453?text=${encodeURIComponent(msg)}`;
}
