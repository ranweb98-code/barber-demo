"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_VIDEO } from "@/lib/assets";

type HeroMediaProps = {
  alt: string;
  priority?: boolean;
};

export function HeroMedia({ alt, priority = true }: HeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDesktop) return;
    void video.play().catch(() => {});
  }, [isDesktop]);

  if (!isDesktop) {
    return (
      <div
        className="page-hero__video page-hero__video--fallback"
        aria-label={alt}
        role="img"
      />
    );
  }

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
