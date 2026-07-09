const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.config = functions
  .region("asia-south1")
  .https.onRequest(async (req, res) => {
    // CORS configuration for the endpoint
    res.set("Access-Control-Allow-Origin", req.headers.origin === "https://www.packzenblr.in" ? "https://www.packzenblr.in" : "https://packzenblr.in");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const origin = req.headers.origin;
    if (origin !== "https://packzenblr.in" && origin !== "https://www.packzenblr.in") {
      return res.status(403).json({ error: "Forbidden: Invalid origin" });
    }

    const appCheckToken = req.header("X-Firebase-AppCheck");
    if (!appCheckToken) {
      return res.status(401).json({ error: "Unauthorized: Missing App Check token" });
    }

    try {
      await admin.appCheck().verifyToken(appCheckToken);

      return res.status(200).json({
        FIREBASE_CONFIG: {
          apiKey: functions.config().frontend?.firebase_api_key || "AIzaSyCNZdOeUlwlI9kwkzD05R1xEy8EyuP8VJo",
          authDomain: "packzen-e7539.firebaseapp.com",
          projectId: "packzen-e7539",
          storageBucket: "packzen-e7539.firebasestorage.app",
          messagingSenderId: "270978358338",
          appId: "1:270978358338:web:20827d29d23b654925e1db",
          measurementId: "G-9JXKP58GP3"
        },
        GOOGLE_MAPS_KEY: functions.config().frontend?.google_maps_key || "AIzaSyA0_uDJsx8EqoChj865kWk_vveoPfehdzQ",
        RAZORPAY_KEY: functions.config().frontend?.razorpay_key || "rzp_live_Sychk409VJWOfI"
      });
    } catch (err) {
      console.error("App Check verification error:", err);
      return res.status(401).json({ error: "Unauthorized: Invalid App Check token" });
    }
  });
