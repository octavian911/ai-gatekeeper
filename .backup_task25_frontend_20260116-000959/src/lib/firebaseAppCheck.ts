import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

/**
 * IMPORTANT:
 * - This uses the PUBLIC reCAPTCHA v3 site key from Vite env.
 * - You must also enable App Check in Firebase Console for this Web app.
 */

// If you already have Firebase config somewhere else, import it instead.
// Otherwise, paste your firebaseConfig in here.
const firebaseConfig = {
  // TODO: replace with your Firebase web app config from Firebase Console
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export function initAppCheck() {
  // Avoid initializing more than once in dev hot reload
  // @ts-ignore
  if (window.__appCheckInited) return;

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY),
    // Set true only if you need local testing before enforcement:
    isTokenAutoRefreshEnabled: true,
  });

  // @ts-ignore
  window.__appCheckInited = true;
}
