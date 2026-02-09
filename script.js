let pickupPlace, dropPlace;
let map, directionsService, directionsRenderer;
let pickupMarker, dropMarker;

const MIN_BASE_PRICE = 1100;

function initAutocomplete(){
  const pickupAuto = new google.maps.places.Autocomplete(pickup);
  const dropAuto = new google.maps.places.Autocomplete(drop);

  pickupAuto.addListener("place_changed",()=>{
    pickupPlace = pickupAuto.getPlace();
    showLocation("pickup");
  });

  dropAuto.addListener("place_changed",()=>{
    dropPlace = dropAuto.getPlace();
    showLocation("drop");
  });

  useCurrentLocation.addEventListener("change",()=>{
    navigator.geolocation.getCurrentPosition(pos=>{
      const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
      const geo=new google.maps.Geocoder();
      geo.geocode({location:loc},(res)=>{
        pickup.value=res[0].formatted_address;
        pickupPlace={geometry:{location:loc}};
        showLocation("pickup");
      });
    });
  });
}

function showLocation(type){
  const loc=(type==="pickup"?pickupPlace:dropPlace)?.geometry?.location;
  if(!loc) return;

  if(!map){
    map=new google.maps.Map(mapDiv,{center:loc,zoom:14});
    directionsService=new google.maps.DirectionsService();
    directionsRenderer=new google.maps.DirectionsRenderer({map});
  }

  if(pickupPlace && dropPlace){
    directionsService.route({
      origin:pickupPlace.geometry.location,
      destination:dropPlace.geometry.location,
      travelMode:"DRIVING"
    },(res)=>directionsRenderer.setDirections(res));
  }
}

function calculateQuote(){
  if(!pickup.value||!drop.value) return;

  let cost=MIN_BASE_PRICE;
  cost+=Number(house.value||0);

  if(sofaCheck.checked) cost+=500*Number(sofaQty.value);
  if(bedCheck.checked) cost+=700*Number(bedQty.value);
  if(fridgeCheck.checked) cost+=400;
  if(wmCheck.checked) cost+=400;

  result.innerHTML=`<strong>Total Estimate: ₹${cost}</strong>`;
}

function bookOnWhatsApp(){
  calculateQuote();
  window.location.href=`https://wa.me/919945095453?text=${encodeURIComponent(result.innerText)}`;
}

/* STEP FORM */

let currentStep = 0;
const steps = document.querySelectorAll(".form-step");

function showStep(n) {
  steps.forEach(step => step.classList.remove("active"));
  steps[n].classList.add("active");

  document.getElementById("progressBar").style.width =
    ((n + 1) / steps.length) * 100 + "%";

  // Calculate quote when reaching last step
  if (n === steps.length - 1) {
    calculateQuote();
  }
}

function nextStep() {
  if (currentStep < steps.length - 1) {
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    showStep(currentStep);
  }
}
