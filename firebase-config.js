// ================================================
//   firebase-config.js — PackZen
//   Fixed: sequential loading, no race conditions
// ================================================

(function loadFirebase() {

  const scripts = [
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics-compat.js"
  ];

  // Load scripts ONE BY ONE (sequential) — guarantees firebase is ready
  function loadNext(index) {
    if (index >= scripts.length) { initFirebase(); return; }
    const s = document.createElement("script");
    s.src = scripts[index];
    s.onload  = () => loadNext(index + 1);
    s.onerror = () => { console.error("Failed:", scripts[index]); loadNext(index + 1); };
    document.head.appendChild(s);
  }

  function initFirebase() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey:            "AIzaSyDFJNH0jIm5XiDEsCy5-j5LVybzO60tCuo",
          authDomain:        "packzen-e7539.firebaseapp.com",
          projectId:         "packzen-e7539",
          storageBucket:     "packzen-e7539.firebasestorage.app",
          messagingSenderId: "270978358338",
          appId:             "1:270978358338:web:20827d29d23b654925e1db",
          measurementId:     "G-9JXKP58GP3"
        });
      } 
    } catch(e) {
      console.error("Firebase init failed:", e);
      return;
    }

    const auth = firebase.auth();
    const db   = firebase.firestore();

    window._firebase = { auth, db };

    console.log("✅ PackZen Firebase ready!");
  }

  loadNext(0);

})();
