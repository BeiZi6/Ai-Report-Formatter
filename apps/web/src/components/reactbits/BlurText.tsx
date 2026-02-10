"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

type BlurTextProps = {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "chars";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  stepDuration?: number;
  dataTestId?: string;
};

const buildKeyframes = (
  from: { filter: string; opacity: number; y: number },
  steps: Array<{ filter: string; opacity: number; y: number }>,
) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap((step) => Object.keys(step))]);
  const keyframes: Record<string, Array<string | number>> = {};

  keys.forEach((key) => {
    keyframes[key] = [from[key as keyof typeof from], ...steps.map((step) => step[key as keyof typeof step])];
  });

  return keyframes;
};

export default function BlurText({
  text,
  delay = 110,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  stepDuration = 0.28,
  dataTestId,
}: BlurTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const canAnimate = !prefersReducedMotion;
  const segments = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const wrapperRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!canAnimate || !wrapperRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [canAnimate, threshold, rootMargin]);

  const fromSnapshot = useMemo(
    () => (direction === "top" ? { filter: "blur(10px)", opacity: 0, y: -30 } : { filter: "blur(10px)", opacity: 0, y: 30 }),
    [direction],
  );

  const toSnapshots = useMemo(
    () => [
      {
        filter: "blur(5px)",
        opacity: 0.55,
        y: direction === "top" ? 4 : -4,
      },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction],
  );

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, index) => (stepCount === 1 ? 0 : index / (stepCount - 1)));

  const keyedSegments = (() => {
    const counts = new Map<string, number>();
    return segments.map((segment, position) => {
      const count = counts.get(segment) ?? 0;
      counts.set(segment, count + 1);
      return { segment, position, key: `${segment}-${count}` };
    });
  })();

  return (
    <p ref={wrapperRef} className={className} style={{ display: "flex", flexWrap: "wrap" }} data-testid={dataTestId}>
      {keyedSegments.map(({ segment, position, key }) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);
        const transition = {
          duration: totalDuration,
          times,
          delay: (position * delay) / 1000,
          ease: [0.16, 1, 0.3, 1],
        };

        if (!canAnimate) {
          return (
            <span key={key}>
              {segment === " " ? "\u00A0" : segment}
              {animateBy === "words" && position < keyedSegments.length - 1 && "\u00A0"}
            </span>
          );
        }

        return (
          <motion.span
            key={key}
            className="inline-block"
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={transition}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && position < keyedSegments.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </p>
  );
}
