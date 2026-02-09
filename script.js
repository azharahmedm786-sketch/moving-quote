// Global variables for places
let pickupPlace, dropPlace;

// Initialize Google Maps Autocomplete
function initAutocomplete() {
    const options = {
        componentRestrictions: { country: "in" },
        fields: ["address_components", "geometry", "name"]
    };
    
    const pickupInput = document.getElementById("pickup");
    const dropInput = document.getElementById("drop");

    const autoPickup = new google.maps.places.Autocomplete(pickupInput, options);
    const autoDrop = new google.maps.places.Autocomplete(dropInput, options);

    // Update progress bar when a place is selected
    autoPickup.addListener("place_changed", () => {
        pickupPlace = autoPickup.getPlace();
        updateProgress();
    });

    autoDrop.addListener("place_changed", () => {
        dropPlace = autoDrop.getPlace();
        updateProgress();
    });
}

// Logic to move the Progress Bar
function updateProgress() {
    let score = 0;
    
    // Check fields and increment score
    if (document.getElementById("pickup").value.length > 2) score += 25;
    if (document.getElementById("drop").value.length > 2) score += 25;
    if (document.getElementById("house").value !== "0") score += 25;
    if (document.getElementById("vehicle").value !== "") score += 25;

    // Update the UI
    const bar = document.getElementById("progressBar");
    bar.style.width = score + "%";
    
    // Change color to green when complete
    if (score === 100) {
        bar.style.background = "#22c55e";
    } else {
        bar.style.background = "#0284c7";
    }
}

// Main Calculation Function
function calculateQuote() {
    const pickup = document.getElementById("pickup").value;
    const drop = document.getElementById("drop").value;
    const houseVal = Number(document.getElementById("house").value);

    // Validation
    if (!pickup || !drop || houseVal === 0) {
        alert("Please fill in the pickup, drop, and house type!");
        return;
    }

    // Show Loader
    document.getElementById("loader").style.display = "flex";

    // Simulate calculation delay for "Pro" feel
    setTimeout(() => {
        const vehicleRate = Number(document.getElementById("vehicle").value);
        
        // Add-on Furniture Logic
        let furnitureExtra = 0;
        if (document.getElementById("sofaCheck").checked) furnitureExtra += 500;
        if (document.getElementById("bedCheck").checked) furnitureExtra += 700;
        if (document.getElementById("fridgeCheck").checked) furnitureExtra += 400;

        // Final Calculation (Base 1100 + House + Vehicle Rate * 10km demo distance)
        const demoDistance = 10;
        const total = 1100 + houseVal + (demoDistance * vehicleRate) + furnitureExtra;

        // UI Updates: Reveal Price and Booking Button
        document.getElementById("livePrice").innerText = "₹" + Math.round(total).toLocaleString('en-IN');
        document.getElementById("priceBreakup").innerText = "Includes professional packing, loading, and transport.";
        
        const pricePanel = document.getElementById("priceContainer");
        const bookBtn = document.querySelector(".book-btn");
        
        pricePanel.style.display = "block";
        bookBtn.style.display = "block";

        // Hide Loader
        document.getElementById("loader").style.display = "none";

        // Smooth scroll to the result
        pricePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 1500);
}

// WhatsApp Integration
function bookOnWhatsApp() {
    const pickup = document.getElementById("pickup").value;
    const drop = document.getElementById("drop").value;
    const price = document.getElementById("livePrice").innerText;
    const houseType = document.getElementById("house").options[document.getElementById("house").selectedIndex].text;

    const message = `*PackZen Booking Request*%0A` +
                    `--------------------------%0A` +
                    `*From:* ${pickup}%0A` +
                    `*To:* ${drop}%0A` +
                    `*Type:* ${houseType}%0A` +
                    `*Quote:* ${price}%0A` +
                    `--------------------------%0A` +
                    `I want to confirm this booking. Please contact me.`;

    window.open(`https://wa.me/919945095453?text=${message}`, '_blank');
}

// Attach event listeners for progress tracking on simple selects
document.getElementById("house").addEventListener("change", updateProgress);
document.getElementById("vehicle").addEventListener("change", updateProgress);
