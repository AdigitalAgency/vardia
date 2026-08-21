"use client";

import { useEffect } from "react";

/** Καταχωρεί τον service worker. Χωρίς αυτόν το app δουλεύει κανονικά — απλώς online-only. */
export default function PwaSetup() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // στο dev ενοχλεί το HMR
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Το PWA είναι enhancement — αν αποτύχει, δεν χαλάει τίποτα.
    });
  }, []);
  return null;
}
