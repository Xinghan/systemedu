"use client";

import { useState, useEffect } from "react";

export default function Stars() {
  const [stars, setStars] = useState<
    { id: number; left: string; top: string; size: number; duration: string; delay: string }[]
  >([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        duration: `${Math.random() * 3 + 2}s`,
        delay: `${Math.random() * 3}s`,
      }))
    );
  }, []);

  return (
    <div className="stars">
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ["--duration" as any]: star.duration,
            ["--delay" as any]: star.delay,
          }}
        />
      ))}
    </div>
  );
}
