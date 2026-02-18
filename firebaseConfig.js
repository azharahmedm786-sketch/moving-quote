// ================================================
//   firebase-config.js — PackZen
//   Firebase is ready! Your config is active.
// ================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey:            "AIzaSyDFJNH0jIm5XiDEsCy5-j5LVybzO60tCuo",
  authDomain:        "packzen-e7539.firebaseapp.com",
  projectId:         "packzen-e7539",
  storageBucket:     "packzen-e7539.firebasestorage.app",
  messagingSenderId: "270978358338",
  appId:             "1:270978358338:web:20827d29d23b654925e1db",
  measurementId:     "G-9JXKP58GP3"
};

// Initialize Firebase
const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);

// Make available globally to script.js
window._firebase = {
  auth, db,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut,
  doc, setDoc, getDoc,
  collection, addDoc, getDocs,
  query, where, orderBy
};

console.log("✅ PackZen Firebase ready!");
