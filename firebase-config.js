// ================================================
//   firebase-config.js — PackZen
//   Sequential loading + Auth + Firestore + Functions
//   UPDATED: Uses Auth API key from env-config.js
// ================================================

(function loadFirebase() {

  const scripts = [
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions-compat.js"
  ];

  // Load scripts ONE BY ONE (sequential)
  function loadNext(index) {
    if (index >= scripts.length) {
      initFirebase();
      return;
    }

    const s = document.createElement("script");
    s.src = scripts[index];
    s.onload = () => loadNext(index + 1);
    s.onerror = () => {
      console.error("Failed loading:", scripts[index]);
      loadNext(index + 1);
    };

    document.head.appendChild(s);
  }

  function initFirebase() {
    try {
      // Wait for env-config.js to load and provide the keys
      if (!window.ENV) {
        console.error("❌ env-config.js not loaded! Make sure it's included before firebase-config.js");
        return;
      }

      if (!window.ENV.FIREBASE_AUTH_KEY) {
        console.error("❌ FIREBASE_AUTH_KEY not found in env-config.js!");
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp({
          // Use the Auth API key from env-config.js (unrestricted for reCAPTCHA)
          apiKey: window.ENV.FIREBASE_AUTH_KEY,
          authDomain: "packzen-e7539.firebaseapp.com",
          projectId: "packzen-e7539",
          storageBucket: "packzen-e7539.firebasestorage.app",
          messagingSenderId: "270978358338",
          appId: "1:270978358338:web:20827d29d23b654925e1db",
          measurementId: "G-9JXKP58GP3"
        });
        console.log("✅ Firebase initialized with Auth API key");
      }
    } catch (e) {
      console.error("❌ Firebase init failed:", e);
      return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();
    const functions = firebase.app().functions("us-central1");

    // Make everything globally accessible
    window._firebase = { auth, db, functions };

    console.log("✅ PackZen Firebase ready with Functions!");
  }

  // Wait a moment for env-config.js to load if it's not ready
  if (window.ENV) {
    loadNext(0);
  } else {
    console.log("⏳ Waiting for env-config.js to load...");
    setTimeout(() => {
      if (window.ENV) {
        loadNext(0);
      } else {
        console.error("❌ env-config.js failed to load after waiting");
      }
    }, 500);
  }

})();
