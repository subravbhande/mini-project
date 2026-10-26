import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== '' &&
  !firebaseConfig.apiKey.includes('PASTE_YOUR')
);

let auth = null;
if (isFirebaseConfigured) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    
    // Automatically disable Google reCAPTCHA on localhost so NO bicycle / puzzle captchas appear
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      auth.settings.appVerificationDisabledForTesting = true;
    }
  } catch (err) {
    console.warn('[Firebase] Initialization warning:', err.message);
  }
}

export { auth, RecaptchaVerifier, signInWithPhoneNumber };
