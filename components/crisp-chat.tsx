"use client";

import { useEffect } from "react";

export function CrispChat() {
  useEffect(() => {
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = "192383fc-e562-4550-b428-cea293140947";

    // Match platform amber accent
    window.$crisp.push(["config", "color:theme", "#E8A020"]);

    const s = document.createElement("script");
    s.src = "https://client.crisp.chat/l.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  return null;
}

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}
