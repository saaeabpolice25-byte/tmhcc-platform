// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyAxFBGjS9VB8H6bd5I_b7R25eLZIm4YZss",
//   authDomain: "tmhcc-platform.firebaseapp.com",
//   projectId: "tmhcc-platform",
//   storageBucket: "tmhcc-platform.firebasestorage.app",
//   messagingSenderId: "978696478225",
//   appId: "1:978696478225:web:2695b1f6635c28c6f89bb0"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);


//firebase/config.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxFBGjS9VB8H6bd5I_b7R25eLZIm4YZss",
  authDomain: "tmhcc-platform.firebaseapp.com",
  projectId: "tmhcc-platform",
  storageBucket: "tmhcc-platform.firebasestorage.app",
  messagingSenderId: "978696478225",
  appId: "1:978696478225:web:2695b1f6635c28c6f89bb0"
};

// Initialize Firebase (Prevent duplicate initialization on hot reload)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };