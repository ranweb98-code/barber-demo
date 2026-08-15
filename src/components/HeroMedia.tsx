"use client";

import { useEffect, useRef } from "react";
import { HERO_VIDEO } from "@/lib/assets";

type HeroMediaProps = {
  alt: string;
  priority?: boolean;
};

export function HeroMedia({ alt, priority = true }: HeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={videoRef}
      src={HERO_VIDEO}
      autoPlay
      muted
      loop
      playsInline
      preload={priority ? "auto" : "metadata"}
      aria-label={alt}
      className="page-hero__video object-cover grayscale"
    />
  );
}
