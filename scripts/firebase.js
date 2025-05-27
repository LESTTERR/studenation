import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsqjObXtK5_xPMUxLcsD6SQyZlgjq7ydk",
  authDomain: "studenation-2d403.firebaseapp.com",
  projectId: "studenation-2d403",
  storageBucket: "studenation-2d403.appspot.com",
  messagingSenderId: "8846896127",
  appId: "1:8846896127:web:c723357d96b44f8ec395ca",
  measurementId: "G-94LBEBDFTF"
};

export const app = initializeApp(firebaseConfig); // ✅ FIX: export it
export const auth = getAuth(app);
export const db = getFirestore(app);
