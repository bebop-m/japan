"use client";

import { useEffect, useState } from "react";

const BOOT_KEY = "nihongo-go/boot-seen";

export function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storage = window.sessionStorage;

    if (storage.getItem(BOOT_KEY) === "1") {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      storage.setItem(BOOT_KEY, "1");
      return;
    }

    setVisible(true);

    const readyTimer = window.setTimeout(() => {
      setReady(true);
    }, 850);

    const closeTimer = window.setTimeout(() => {
      storage.setItem(BOOT_KEY, "1");
      setVisible(false);
    }, 2000);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(closeTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      className={`boot-sequence ${ready ? "boot-sequence--ready" : ""}`.trim()}
      onClick={() => {
        window.sessionStorage.setItem(BOOT_KEY, "1");
        setVisible(false);
      }}
      aria-label="Skip startup animation"
    >
      <div className="boot-sequence__panel">
        <div className="boot-sequence__brand">NIHONGO.GO</div>
        <div className="boot-sequence__cartridge">INSERT CARTRIDGE</div>
        <div className="boot-sequence__bar" />
        <div className="boot-sequence__hint">{ready ? "PRESS START" : "BOOTING..."}</div>
      </div>
    </button>
  );
}
