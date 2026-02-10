"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import styles from "./Squares.module.css";

type ScrollDirection = "right" | "left" | "up" | "down" | "diagonal";

const ditherMatrix = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

const mod = (value: number, base: number) => ((value % base) + base) % base;

type SquaresProps = {
  direction?: ScrollDirection;
  speed?: number;
  gravity?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  className?: string;
};

export default function Squares({
  direction = "diagonal",
  speed = 0.5,
  gravity = 0,
  borderColor = "rgba(101, 170, 214, 0.38)",
  squareSize = 44,
  hoverFillColor = "rgba(65, 215, 178, 0.22)",
  className = "",
}: SquaresProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const gridOffsetRef = useRef({ x: 0, y: 0 });
  const gravityOffsetRef = useRef(0);
  const gravityVelocityRef = useRef(0);
  const hoveredSquareRef = useRef<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.floor(canvas.offsetWidth);
      const height = Math.floor(canvas.offsetHeight);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGrid();
    };

    const drawGrid = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      ctx.clearRect(0, 0, width, height);

      const renderOffsetY = gridOffsetRef.current.y - gravityOffsetRef.current;
      const offsetX = mod(gridOffsetRef.current.x, squareSize);
      const offsetY = mod(renderOffsetY, squareSize);
      const ditherSize = Math.max(2, Math.floor(squareSize / 8));
      const time = frameRef.current;

      for (let y = -ditherSize; y <= height + ditherSize; y += ditherSize) {
        for (let x = -ditherSize; x <= width + ditherSize; x += ditherSize) {
          const matrixX = mod(Math.floor((x + offsetX) / ditherSize), 4);
          const matrixY = mod(Math.floor((y + offsetY) / ditherSize), 4);
          const threshold = (ditherMatrix[matrixY][matrixX] + 1) / 17;

          const wave =
            (Math.sin((x + gridOffsetRef.current.x) * 0.028 + time * 0.016) +
              Math.cos((y + renderOffsetY) * 0.024 - time * 0.012)) *
              0.25 +
            0.5;

          if (wave > threshold) {
            ctx.fillStyle = borderColor;
            ctx.fillRect(x, y, ditherSize, ditherSize);
          }
        }
      }

      if (hoveredSquareRef.current) {
        const hoverX = hoveredSquareRef.current.x * squareSize - offsetX;
        const hoverY = hoveredSquareRef.current.y * squareSize - offsetY;
        ctx.fillStyle = hoverFillColor;
        ctx.fillRect(hoverX, hoverY, squareSize, squareSize);
      }
    };

    const updateAnimation = () => {
      if (!prefersReducedMotion) {
        frameRef.current += 1;
        const effectiveSpeed = Math.max(speed, 0.1);
        switch (direction) {
          case "right":
            gridOffsetRef.current.x = (gridOffsetRef.current.x - effectiveSpeed + squareSize) % squareSize;
            break;
          case "left":
            gridOffsetRef.current.x = (gridOffsetRef.current.x + effectiveSpeed + squareSize) % squareSize;
            break;
          case "up":
            gridOffsetRef.current.y = (gridOffsetRef.current.y + effectiveSpeed + squareSize) % squareSize;
            break;
          case "down":
            gridOffsetRef.current.y = (gridOffsetRef.current.y - effectiveSpeed + squareSize) % squareSize;
            break;
          case "diagonal":
            gridOffsetRef.current.x = (gridOffsetRef.current.x - effectiveSpeed + squareSize) % squareSize;
            gridOffsetRef.current.y = (gridOffsetRef.current.y - effectiveSpeed + squareSize) % squareSize;
            break;
          default:
            break;
        }

        if (gravity > 0) {
          const gravityStrength = Math.max(gravity, 0.01);
          const maxFallSpeed = Math.max(speed * 3, gravityStrength * 7, 0.8);
          gravityVelocityRef.current = Math.min(
            gravityVelocityRef.current + gravityStrength * 0.03,
            maxFallSpeed,
          );
          gravityOffsetRef.current += gravityVelocityRef.current;

          if (gravityOffsetRef.current >= squareSize) {
            gravityOffsetRef.current -= squareSize;
            gravityVelocityRef.current *= 0.55;
          }
        } else {
          gravityOffsetRef.current = 0;
          gravityVelocityRef.current = 0;
        }
      } else {
        frameRef.current = 0;
        gravityOffsetRef.current = 0;
        gravityVelocityRef.current = 0;
      }

      drawGrid();
      requestRef.current = requestAnimationFrame(updateAnimation);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const renderOffsetY = gridOffsetRef.current.y - gravityOffsetRef.current;

      hoveredSquareRef.current = {
        x: Math.floor((mouseX + mod(gridOffsetRef.current.x, squareSize)) / squareSize),
        y: Math.floor((mouseY + mod(renderOffsetY, squareSize)) / squareSize),
      };
    };

    const handleMouseLeave = () => {
      hoveredSquareRef.current = null;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    requestRef.current = requestAnimationFrame(updateAnimation);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);

      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [borderColor, direction, gravity, hoverFillColor, prefersReducedMotion, speed, squareSize]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${className}`.trim()}
      data-gravity-enabled={gravity > 0 ? "true" : "false"}
      data-gravity-axis={gravity > 0 ? "y-down" : "off"}
      data-bg-style="dither"
    />
  );
}
