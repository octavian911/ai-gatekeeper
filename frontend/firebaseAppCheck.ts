import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeApp, type FirebaseApp, getApp, getApps } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// NOTE: App Check requires a Firebase Web App config.
// Put these in frontend/.env as VITE_FIREBASE_* values.
// The reCAPTCHA v3 site key is PUBLIC and also lives in frontend/.env.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;

export function initAppCheck() {
  // prevent double init in dev/hot reload
  // @ts-ignore
  if (typeof window !== "undefined" && window.__appCheckInited) return;

  // Minimal validation to avoid confusing runtime crashes
  const missing = Object.entries(firebaseConfig).filter(([_, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.warn("[AppCheck] Missing Firebase env vars:", missing.join(", "));
    console.warn("[AppCheck] Add VITE_FIREBASE_* values to frontend/.env");
    return;
  }

  if (!import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY) {
    console.warn("[AppCheck] Missing VITE_RECAPTCHA_V3_SITE_KEY in frontend/.env");
    return;
  }

  app = app ?? initializeApp(firebaseConfig);

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });

  // @ts-ignore
  if (typeof window !== "undefined") window.__appCheckInited = true;
}


/**
 * Auth helper for calling protected Functions endpoints from the browser.
 * Assumes your Firebase app is already initialized somewhere in the frontend.
 */
function _getExistingAppOrNull() {
  try {
    return getApps().length ? getApp() : null;
  } catch {
    return null;
  }
}

export async function getIdTokenOrNull(): Promise<string | null> {
  const app = _getExistingAppOrNull();
  if (!app) return null;

  const auth = getAuth(app);

  // already signed in
  if (auth.currentUser) return await auth.currentUser.getIdToken();

  // attempt anonymous sign-in (must be enabled in Firebase Console)
  try {
    await signInAnonymously(auth);
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}


/**
 * Ensure we have a Firebase Auth user (Anonymous).
 * Requires: Firebase Console -> Authentication -> Sign-in method -> Anonymous ENABLED.
 */
export async function ensureSignedIn(): Promise<void> {
  const auth = getAuth();
  if (auth.currentUser) return;

  // Wait for initial auth state, then sign in if needed.
  await new Promise<void>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      unsub();
      try {
        if (u) return resolve();
        await signInAnonymously(auth);
        resolve();
      } catch (e) {
        reject(e);
      }
    }, reject);
  });
}

/**
 * Returns headers needed for authenticated API calls.
 * - Uses Firebase Auth ID token (works for anonymous users too, if anonymous auth is enabled).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    // Lazy import to avoid affecting init order in some builds
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (e) {
    // Don't hard-fail the UI just because auth headers can't be produced.
    console.warn("getAuthHeaders() failed:", e);
  }
  return headers;
}
