import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase Applet Config dari platform
const firebaseConfig = {
  apiKey: "AIzaSyDD4Hw2I4JkEJR5M1_0qGJ8RD9p6FqiRs0",
  authDomain: "farmtrace-496512.firebaseapp.com",
  projectId: "farmtrace-496512",
  storageBucket: "farmtrace-496512.firebasestorage.app",
  messagingSenderId: "524653969514",
  appId: "1:524653969514:web:c60b26244b260ed9374a13"
};

// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Ekspor Auth instance
export const auth = getAuth(app);
