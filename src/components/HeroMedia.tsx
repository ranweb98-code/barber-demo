"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HERO_POSTER, HERO_VIDEO } from "@/lib/assets";

type HeroMediaProps = {
  alt: string;
  priority?: boolean;
};

export function HeroMedia({ alt, priority = true }: HeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPoster, setShowPoster] = useState(false);

  useEffect(() => {
    if (showPoster) return;

    const video = videoRef.current;
    if (!video) return;

    const onError = () => setShowPoster(true);

    video.addEventListener("error", onError);
    void video.play().catch(() => setShowPoster(true));

    return () => video.removeEventListener("error", onError);
  }, [showPoster]);

  if (showPoster) {
    return (
      <Image
        src={HERO_POSTER}
        alt={alt}
        fill
        priority={priority}
        loading={priority ? undefined : "lazy"}
        quality={95}
        className="object-cover grayscale"
        sizes="100vw"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={HERO_VIDEO}
      poster={HERO_POSTER}
      autoPlay
      muted
      loop
      playsInline
      preload={priority ? "auto" : "metadata"}
      aria-hidden
      className="page-hero__video object-cover grayscale"
    />
  );
}
