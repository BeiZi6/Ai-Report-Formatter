"use client";

import { useReducedMotion } from "motion/react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

type GradualBlurProps = {
  children: ReactNode;
  className?: string;
  scope?: "global" | "section";
  maxBlur?: number;
  maxOffset?: number;
  minOpacity?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function GradualBlur({
  children,
  className = "",
  scope = "section",
  maxBlur = 5,
  maxOffset = 8,
  minOpacity = 0.88,
}: GradualBlurProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(prefersReducedMotion ? 1 : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setProgress(1);
      return;
    }

    const host = hostRef.current;
    if (!host) {
      return;
    }

    const update = () => {
      const rect = host.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const next =
        scope === "global"
          ? clamp((window.scrollY || 0) / Math.max(viewportHeight * 1.1, 1), 0, 1)
          : (() => {
              const anchor = rect.top + Math.min(rect.height * 0.55, viewportHeight * 0.72);
              const startLine = viewportHeight * 1.05;
              const clearLine = viewportHeight * 0.32;
              const travel = Math.max(startLine - clearLine, 1);
              return clamp((startLine - anchor) / travel, 0, 1);
            })();
      setProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
    };

    const scheduleUpdate = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        update();
      });
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [prefersReducedMotion, scope]);

  const blur = prefersReducedMotion ? 0 : (1 - progress) * maxBlur;
  const offset = prefersReducedMotion ? 0 : (1 - progress) * maxOffset;
  const opacity = prefersReducedMotion ? 1 : minOpacity + (1 - minOpacity) * progress;

  if (scope === "global") {
    const globalBlur = prefersReducedMotion ? 0 : Math.max(0.6, maxBlur * (0.75 - progress * 0.2));
    const globalOffset = prefersReducedMotion ? 0 : Math.max(0, maxOffset * 0.35);
    const globalOpacity = prefersReducedMotion ? 0 : 0.24;
    const overlayStyle = {
      "--gradual-global-blur": `${globalBlur.toFixed(2)}px`,
      "--gradual-global-offset": `${globalOffset.toFixed(2)}px`,
      "--gradual-global-opacity": globalOpacity,
    } as CSSProperties;

    return (
      <div ref={hostRef} className={className} data-gradual-blur="true" data-gradual-blur-scope={scope}>
        {children}
        <div className="gradual-blur-viewport" aria-hidden="true" style={overlayStyle} />
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={className}
      data-gradual-blur="true"
      data-gradual-blur-scope={scope}
      style={{
        filter: `blur(${blur.toFixed(2)}px)`,
        opacity,
        transform: `translateY(${offset.toFixed(2)}px)`,
        transition: "filter 120ms linear, opacity 120ms linear, transform 120ms linear",
        willChange: "filter, opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
