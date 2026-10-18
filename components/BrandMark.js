"use client";

import Image from "next/image";
import { useState } from "react";

export default function BrandMark({ className = "", size = 42 }) {
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  return (
    <span className={`ldis-brand-mark ${className}`} style={{ width: size, height: size, flexBasis: size }} aria-label="LDIS logo">
      {!logoUnavailable ? (
        <Image
          src="/photo/logo.png"
          alt="ভূমি দলিল যাচাই ও নিবন্ধন লোগো"
          width={size}
          height={size}
          onError={() => setLogoUnavailable(true)}
          priority
        />
      ) : (
        <span className="ldis-brand-mark-fallback" aria-hidden="true">ভূ</span>
      )}
    </span>
  );
}
