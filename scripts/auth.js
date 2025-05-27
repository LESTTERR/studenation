// scripts/auth.js
import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

// Register
export function registerUser(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

// Login
export function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Logout
export function logoutUser() {
  return signOut(auth);
}

// Watch User
export function watchAuth(callback) {
  onAuthStateChanged(auth, callback);
}
