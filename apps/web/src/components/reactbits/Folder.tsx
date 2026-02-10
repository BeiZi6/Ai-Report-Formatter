"use client";

import { type CSSProperties, type ReactNode, useMemo, useState } from "react";

import styles from "./Folder.module.css";

type FolderProps = {
  color?: string;
  size?: number;
  items?: ReactNode[];
  className?: string;
  ariaLabel?: string;
  open?: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
  onAction?: () => void;
};

const MAX_ITEMS = 3;

const isHexColor = (value: string) => {
  const normalized = value.startsWith("#") ? value.slice(1) : value;
  return /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
};

const darkenColor = (hex: string, amount: number) => {
  if (!isHexColor(hex)) {
    return hex;
  }

  let normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }

  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;

  const adjust = (channel: number) => Math.max(0, Math.min(255, Math.floor(channel * (1 - amount))));

  return `#${((1 << 24) + (adjust(red) << 16) + (adjust(green) << 8) + adjust(blue)).toString(16).slice(1).toUpperCase()}`;
};

export default function Folder({
  color = "#4065D6",
  size = 1,
  items = [],
  className = "",
  ariaLabel = "打开文件夹",
  open,
  onOpenChange,
  onAction,
}: FolderProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : localOpen;

  const papers = useMemo(() => {
    const trimmed = items.slice(0, MAX_ITEMS);
    while (trimmed.length < MAX_ITEMS) {
      trimmed.push(null);
    }
    return trimmed;
  }, [items]);

  const folderStyle = useMemo(
    () =>
      ({
        "--folder-color": color,
        "--folder-back-color": darkenColor(color, 0.08),
        "--paper-1": darkenColor("#ffffff", 0.1),
        "--paper-2": darkenColor("#ffffff", 0.05),
        "--paper-3": "#ffffff",
      }) as CSSProperties,
    [color],
  );

  const scaleStyle = useMemo(
    () => ({
      transform: `scale(${size})`,
    }),
    [size],
  );

  const paperClasses = [styles.paper1, styles.paper2, styles.paper3];

  return (
    <div className={[styles.folderHost, className].filter(Boolean).join(" ")} style={scaleStyle}>
      <button
        type="button"
        className={`${styles.folderButton} ${isOpen ? styles.open : ""}`}
        style={folderStyle}
        aria-label={ariaLabel}
        onClick={() => {
          const nextOpen = !isOpen;
          if (!isControlled) {
            setLocalOpen(nextOpen);
          }
          onOpenChange?.(nextOpen);
          onAction?.();
        }}
      >
        <div className={styles.folderBack}>
          {papers.map((item, index) => (
            <div key={`paper-${index + 1}`} className={`${styles.paper} ${paperClasses[index]}`}>
              {item}
            </div>
          ))}
          <div className={styles.folderFront} />
          <div className={`${styles.folderFront} ${styles.right}`} />
        </div>
      </button>
    </div>
  );
}
