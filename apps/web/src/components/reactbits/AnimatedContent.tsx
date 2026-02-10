"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

type AnimatedContentProps = {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  direction?: "vertical" | "horizontal";
  reverse?: boolean;
  duration?: number;
  ease?: string;
  threshold?: number;
  delay?: number;
  initialOpacity?: number;
  animateOpacity?: boolean;
};

export default function AnimatedContent({
  children,
  className = "",
  distance = 70,
  direction = "vertical",
  reverse = false,
  duration = 0.75,
  ease = "power3.out",
  threshold = 0.12,
  delay = 0,
  initialOpacity = 0,
  animateOpacity = true,
}: AnimatedContentProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const element = hostRef.current;
    if (!element) {
      return;
    }

    const axis = direction === "horizontal" ? "x" : "y";
    const offset = reverse ? -distance : distance;
    const startPct = (1 - threshold) * 100;

    gsap.set(element, {
      [axis]: offset,
      opacity: animateOpacity ? initialOpacity : 1,
      visibility: "visible",
    });

    const timeline = gsap.timeline({ paused: true, delay });
    timeline.to(element, {
      [axis]: 0,
      opacity: 1,
      duration,
      ease,
    });

    const trigger = ScrollTrigger.create({
      trigger: element,
      start: `top ${startPct}%`,
      once: true,
      onEnter: () => timeline.play(),
    });

    return () => {
      trigger.kill();
      timeline.kill();
    };
  }, [
    animateOpacity,
    delay,
    direction,
    distance,
    duration,
    ease,
    initialOpacity,
    prefersReducedMotion,
    reverse,
    threshold,
  ]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={hostRef} className={className} style={{ visibility: "hidden" }}>
      {children}
    </div>
  );
}
