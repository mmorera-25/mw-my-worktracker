// Firebase initialization for Vite + React (modular SDK)
// Uses Vite env variables prefixed with VITE_FIREBASE_
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBGPQBuoJ4SeaMG7GS7t0c-pHBjs-Es9-k",
  authDomain: "mw-my-worktracker.firebaseapp.com",
  projectId: "mw-my-worktracker",
  storageBucket: "mw-my-worktracker.firebasestorage.app",
  messagingSenderId: "191964311184",
  appId: "1:191964311184:web:0310d89964052f398e7215",
  measurementId: "G-26XYB5VLED"
};

// initializeApp will throw if required values are missing; keep values as typed any
const app = initializeApp(firebaseConfig as any)

// Export commonly used services for convenience
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
const db = getFirestore(app)

export { app, auth, db, googleProvider }
