"use client";

import { useEffect, useRef, useState } from "react";

/** Info kecil yang cuma muncul pas diklik — buat jelasin istilah/konsep tanpa
 * makan tempat permanen kayak banner teks panjang. */
export default function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="info-tip" ref={ref}>
      <button type="button" className="info-tip-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="info-tip-icon">ⓘ</span> {label}
      </button>
      {open && <div className="info-tip-bubble">{children}</div>}
    </div>
  );
}