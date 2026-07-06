from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos/",
            record_video_size={"width": 640, "height": 480}
        )
        page = context.new_page()
        page.goto("http://localhost:3000")

        # Wait for Firebase or other setup
        page.wait_for_timeout(2000)

        # Inject mock data and open modal
        page.evaluate("""
            window.currentUser = { uid: "test-user", email: "test@test.com" };

            // Mock the trackingListener behavior in loadTrackingData
            window.trackingBookingId = "#TESTID";
            const mockBooking = {
                id: "testbooking123",
                status: "transit",
                vehicle: "Mini Truck",
                vehicleNumber: "KA 01 AB 1234",
                driverName: "John Doe",
                driverPhone: "9988776655",
                date: "2023-11-20",
                time: "10:00 AM",
                pickup: "Koramangala, Bangalore",
                drop: "Indiranagar, Bangalore",
                updatedAt: new Date(),
                driverLat: 12.9716,
                driverLng: 77.5946
            };

            // Bypass firestore and call update directly
            if (typeof updateTrackingUI === 'function') {
                document.getElementById('trackingModal').style.display = 'flex';
                document.getElementById('trackingModal').classList.remove('tracking-minimized');
                updateTrackingUI(mockBooking);
            }
        """)

        # Wait for rendering
        page.wait_for_timeout(1000)

        # Ensure timeline is scrolled a bit to show functionality if needed
        # page.evaluate("document.querySelector('.tracking-status-bar').scrollLeft = 50;")
        # page.wait_for_timeout(500)

        # Take screenshot
        page.screenshot(path="/home/jules/verification/screenshots/tracking_modal.png")

        context.close()
        browser.close()

if __name__ == "__main__":
    run()
