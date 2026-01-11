import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { initAppCheck, ensureSignedIn } from "./firebaseAppCheck";

if (import.meta.env.DEV) {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

try {
  initAppCheck();
} catch (e) {
  console.warn("initAppCheck failed:", e);
}

ensureSignedIn()
  .catch((e) =>
    console.warn("Anonymous sign-in failed (enable it in Firebase Console):", e)
  )
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
