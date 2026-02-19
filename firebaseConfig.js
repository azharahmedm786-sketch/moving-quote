// ================================================
//   firebase-config.js — PackZen
//   Uses Firebase CDN compat mode
//   Works perfectly on GitHub Pages ✅
// ================================================

// Load Firebase scripts dynamically — works on any static host
(function loadFirebase() {

  const scripts = [
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics-compat.js"
  ];

  let loaded = 0;

  scripts.forEach(src => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => {
      loaded++;
      if (loaded === scripts.length) initFirebase();
    };
    document.head.appendChild(s);
  });

  function initFirebase() {

    // ✅ Your Firebase Config
    const firebaseConfig = {
      apiKey:            "AIzaSyDFJNH0jIm5XiDEsCy5-j5LVybzO60tCuo",
      authDomain:        "packzen-e7539.firebaseapp.com",
      projectId:         "packzen-e7539",
      storageBucket:     "packzen-e7539.firebasestorage.app",
      messagingSenderId: "270978358338",
      appId:             "1:270978358338:web:20827d29d23b654925e1db",
      measurementId:     "G-9JXKP58GP3"
    };

    // Initialize
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const auth = firebase.auth();
    const db   = firebase.firestore();

    // Make available globally to script.js
    window._firebase = {
      auth, db,

      // Auth methods
      RecaptchaVerifier: (containerId, config) =>
        new firebase.auth.RecaptchaVerifier(containerId, config),

      signInWithPhoneNumber: (phone, appVerifier) =>
        auth.signInWithPhoneNumber(phone, appVerifier),

      createUserWithEmailAndPassword: (email, password) =>
        auth.createUserWithEmailAndPassword(email, password),

      signInWithEmailAndPassword: (email, password) =>
        auth.signInWithEmailAndPassword(email, password),

      sendPasswordResetEmail: (email) =>
        auth.sendPasswordResetEmail(email),

      updateProfile: (user, data) =>
        user.updateProfile(data),

      onAuthStateChanged: (authInstance, callback) =>
        authInstance.onAuthStateChanged(callback),

      signOut: (authInstance) =>
        authInstance.signOut(),

      // Firestore methods
      doc: (dbInstance, ...path) => {
        let ref = dbInstance;
        // path alternates collection/doc
        for (let i = 0; i < path.length; i++) {
          ref = (i % 2 === 0) ? ref.collection(path[i]) : ref.doc(path[i]);
        }
        return ref;
      },

      setDoc: (ref, data, options) =>
        options?.merge ? ref.set(data, { merge: true }) : ref.set(data),

      getDoc: (ref) => ref.get(),

      collection: (dbInstance, name) => dbInstance.collection(name),

      addDoc: (ref, data) => ref.add(data),

      getDocs: (ref) => ref.get(),

      query: (ref, ...constraints) => {
        let q = ref;
        constraints.forEach(c => { q = c(q); });
        return q;
      },

      where: (field, op, value) => (ref) => ref.where(field, op, value),

      orderBy: (field, dir) => (ref) => ref.orderBy(field, dir || "asc"),
    };

    console.log("✅ PackZen Firebase ready!");
  }

})();
