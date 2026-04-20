"use client";

import { useEffect, useState } from "react";

export default function ScreenSizeDebugger() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const updateSize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", updateSize);
    updateSize();

    return () => window.removeEventListener("resize", updateSize);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "10px",
        right: "10px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "6px 12px",
        borderRadius: "20px",
        fontSize: "12px",
        fontFamily: "monospace",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        cursor: "pointer",
        backdropFilter: "blur(4px)",
      }}
      onClick={() => setIsVisible(false)}
      title="Click para ocultar"
    >
      <span style={{ color: "#3b82f6", fontWeight: "bold" }}>DEBUG</span>
      <span>
        {size.width}px × {size.height}px
      </span>
      <span style={{
        backgroundColor: "#1e293b",
        padding: "2px 6px",
        borderRadius: "4px",
        fontSize: "10px",
        color: "#94a3b8"
      }}>
        {getBreakpoint(size.width)}
      </span>
    </div>
  );
}

function getBreakpoint(width: number) {
  if (width < 640) return "XS";
  if (width < 768) return "SM";
  if (width < 1024) return "MD";
  if (width < 1280) return "LG";
  if (width < 1536) return "XL";
  return "2XL";
}
