from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Using a mobile viewport to check mobile responsive timeline
        context = browser.new_context(
            viewport={"width": 375, "height": 812}
        )
        page = context.new_page()
        page.goto("http://localhost:3000")
        page.wait_for_timeout(2000)

        page.evaluate("""
            window.currentUser = { uid: "test-user", email: "test@test.com" };
            window.trackingBookingId = "#TESTID";
            const mockBooking = {
                id: "testbooking123",
                status: "completed",
                vehicle: "Tata Ace",
                vehicleNumber: "KA 02 XY 5678",
                driverName: "Jane Smith",
                driverPhone: "9876543210",
                date: "2023-11-21",
                pickup: "Indiranagar, Bangalore",
                drop: "Whitefield, Bangalore",
                updatedAt: new Date(),
                completedAt: new Date()
            };

            if (typeof updateTrackingUI === 'function') {
                document.getElementById('trackingModal').style.display = 'flex';
                document.getElementById('trackingModal').classList.remove('tracking-minimized');
                updateTrackingUI(mockBooking);
            }
        """)

        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/screenshots/tracking_modal_mobile.png", full_page=True)

        context.close()
        browser.close()

if __name__ == "__main__":
    run()
