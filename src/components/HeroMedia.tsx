"use client";

import { useEffect, useRef } from "react";
import { HERO_VIDEO_DESKTOP, HERO_VIDEO_MOBILE } from "@/lib/assets";

type HeroMediaProps = {
  alt: string;
  priority?: boolean;
};

function HeroVideo({
  src,
  alt,
  priority,
  className,
}: HeroMediaProps & { src: string; className: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload={priority ? "auto" : "metadata"}
      aria-label={alt}
      className={className}
    />
  );
}

export function HeroMedia({ alt, priority = true }: HeroMediaProps) {
  return (
    <>
      <HeroVideo
        src={HERO_VIDEO_MOBILE}
        alt={alt}
        priority={priority}
        className="page-hero__video page-hero__video--mobile object-cover grayscale md:hidden"
      />
      <HeroVideo
        src={HERO_VIDEO_DESKTOP}
        alt={alt}
        priority={priority}
        className="page-hero__video page-hero__video--desktop hidden object-cover md:block"
      />
    </>
  );
}
