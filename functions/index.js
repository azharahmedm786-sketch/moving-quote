const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const https     = require("https");

admin.initializeApp();

/* ============================================================
   SEND SMS VIA MSG91
   Triggered whenever a new doc is added to /smsQueue
   ============================================================ */
exports.sendSMS = functions
  .region("asia-south1")            // Mumbai — lowest latency for India
  .firestore.document("smsQueue/{docId}")
  .onCreate(async (snap, context) => {
    const data   = snap.data();
    const docRef = snap.ref;

    // Skip if already processed (safety check)
    if (data.status !== "pending") return null;

    const { mobile, message } = data;
    if (!mobile || !message) {
      await docRef.update({ status: "failed", error: "Missing mobile or message" });
      return null;
    }

    // Get MSG91 auth key from Firebase environment config
    // Set it with: firebase functions:config:set msg91.authkey="YOUR_KEY" msg91.senderid="PKZNSM"
    const authKey  = functions.config().msg91?.authkey;
    const senderId = functions.config().msg91?.senderid || "PKZNSM";

    if (!authKey) {
      console.error("MSG91 authkey not configured. Run: firebase functions:config:set msg91.authkey=YOUR_KEY");
      await docRef.update({ status: "failed", error: "MSG91 authkey not set" });
      return null;
    }

    try {
      const result = await sendMsg91SMS(authKey, senderId, mobile, message);
      console.log(`✅ SMS sent to ${mobile}:`, result);
      await docRef.update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        response: JSON.stringify(result).slice(0, 500)
      });
    } catch (err) {
      console.error(`❌ SMS failed to ${mobile}:`, err.message);
      const retries = (data.retries || 0) + 1;
      await docRef.update({
        status: retries >= 3 ? "failed" : "pending",  // retry up to 3 times
        retries,
        lastError: err.message,
        lastAttempt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return null;
  });


/* ============================================================
   MSG91 HTTP SEND FUNCTION
   Uses MSG91 Flow API (recommended for DLT-registered templates)
   ============================================================ */
function sendMsg91SMS(authKey, senderId, mobile, message) {
  return new Promise((resolve, reject) => {
    // MSG91 Send SMS API (transactional route 4)
    const postData = JSON.stringify({
      sender:    senderId,
      route:     "4",             // Transactional route
      country:   "91",
      sms: [{
        message:  message,
        to:       [mobile]
      }]
    });

    const options = {
      hostname: "api.msg91.com",
      path:     "/api/v2/sendsms",
      method:   "POST",
      headers: {
        "authkey":       authKey,
        "Content-Type":  "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.type === "success") resolve(parsed);
          else reject(new Error(parsed.message || body));
        } catch {
          reject(new Error("Invalid response: " + body.slice(0, 200)));
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}


/* ============================================================
   OPTIONAL: Admin trigger to manually retry a failed SMS
   Call via Firebase Admin SDK or from admin panel
   ============================================================ */
exports.retrySMS = functions
  .region("asia-south1")
  .https.onCall(async (data, context) => {
    // Only allow admin users
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Admin only");
    }

    const { docId } = data;
    if (!docId) throw new functions.https.HttpsError("invalid-argument", "docId required");

    await admin.firestore().collection("smsQueue").doc(docId).update({
      status: "pending", retries: 0
    });
    return { success: true };
  });
const Razorpay = require("razorpay");
const cors = require("cors")({
  origin: [
    "https://packzenblr.in",
    "https://www.packzenblr.in",
    "http://localhost:5000"
  ]
});

const razorpay = new Razorpay({
  key_id: "rzp_live_Sn8LmBe51Sy0jv",
  key_secret: "TB40xu7vy1MVSz5zj47ejIGW"
});

exports.createRazorpayOrder = functions
  .region("asia-south1")
  .https.onRequest((req, res) => {

    cors(req, res, async () => {

      try {

        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }

        const amount = req.body.amount;

        if (!amount) {
          return res.status(400).json({
            error: "Amount is required"
          });
        }

        const options = {
          amount: amount * 100,
          currency: "INR",
          receipt: "receipt_" + Date.now()
        };

        const order = await razorpay.orders.create(options);

        return res.status(200).json(order);

      } catch (error) {

        console.error("Razorpay Error:", error);

        return res.status(500).json({
          error: error.message
        });

      }

    });

});