let pickupPlace, dropPlace;
const MIN_BASE_PRICE = 1100;
const FRIDGE_PRICE = 400;

// Initialize Google Autocomplete
function initAutocomplete() {
    const options = { componentRestrictions: { country: "in" } }; // Focus on India
    
    const pickupInput = document.getElementById("pickup");
    const dropInput = document.getElementById("drop");

    const autoPickup = new google.maps.places.Autocomplete(pickupInput, options);
    const autoDrop = new google.maps.places.Autocomplete(dropInput, options);

    autoPickup.addListener("place_changed", () => {
        pickupPlace = autoPickup.getPlace();
    });
    autoDrop.addListener("place_changed", () => {
        dropPlace = autoDrop.getPlace();
    });
}

/**
 * CALCULATE PRICE Logic
 */
async function calculateQuote() {
    const pickupAddr = document.getElementById("pickup").value;
    const dropAddr = document.getElementById("drop").value;

    if (!pickupAddr || !dropAddr) {
        alert("Please enter both pickup and drop locations.");
        return;
    }

    // Show Loader
    document.getElementById("loader").style.display = "flex";

    // Use Google Distance Matrix to get real distance
    const service = new google.maps.DistanceMatrixService();
    
    service.getDistanceMatrix({
        origins: [pickupAddr],
        destinations: [dropAddr],
        travelMode: 'DRIVING',
    }, (response, status) => {
        if (status === 'OK') {
            const distanceText = response.rows[0].elements[0].distance.text;
            const distanceVal = response.rows[0].elements[0].distance.value / 1000; // Convert to KM

            processFinalQuote(distanceVal, distanceText);
        } else {
            alert("Error calculating distance. Using default rate.");
            processFinalQuote(10, "10 km (est)");
        }
    });
}

function processFinalQuote(distance, distanceText) {
    const houseCost = Number(document.getElementById("house").value);
    const perKmRate = Number(document.getElementById("vehicle").value);
    
    // Furniture logic
    let furniture = 0;
    let items = [];
    if (document.getElementById("sofaCheck").checked) { furniture += 500; items.push("Sofa"); }
    if (document.getElementById("bedCheck").checked) { furniture += 700; items.push("Bed"); }
    if (document.getElementById("fridgeCheck").checked) { furniture += FRIDGE_PRICE; items.push("Fridge"); }

    const distanceCost = distance * perKmRate;
    const total = MIN_BASE_PRICE + houseCost + distanceCost + furniture;

    // Update UI
    document.getElementById("livePrice").innerText = "₹" + Math.round(total);
    document.getElementById("priceBreakup").innerHTML = `Distance: ${distanceText} | Items: ${items.length > 0 ? items.join(", ") : "None"}`;
    
    // Hide Loader
    document.getElementById("loader").style.display = "none";
    
    // Smooth scroll to result
    document.getElementById("livePrice").scrollIntoView({ behavior: 'smooth' });
}

/**
 * WHATSAPP BOOKING
 */
function bookOnWhatsApp() {
    const pickup = document.getElementById("pickup").value;
    const drop = document.getElementById("drop").value;
    const price = document.getElementById("livePrice").innerText;
    const houseType = document.getElementById("house").options[document.getElementById("house").selectedIndex].text;

    if (price === "₹0") {
        alert("Please calculate the price first!");
        return;
    }

    const message = `*New Booking Request - PackZen*%0A` +
                    `----------------------------%0A` +
                    `*From:* ${pickup}%0A` +
                    `*To:* ${drop}%0A` +
                    `*House:* ${houseType}%0A` +
                    `*Estimated Quote:* ${price}%0A` +
                    `----------------------------%0A` +
                    `Please confirm my booking.`;

    window.open(`https://wa.me/919945095453?text=${message}`, '_blank');
}
