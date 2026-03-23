import React, { ReactNode, useState, useRef, MouseEvent, useEffect } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  orbColor1?: string;
  orbColor2?: string;
  onClick?: () => void;
}

export function AnimatedCard({
  children,
  className = "",
  orbColor1 = "rgba(124, 58, 237, 0.15)", // Primary (Violet)
  onClick,
}: AnimatedCardProps) {
  const Component = onClick ? "button" : "div";
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement | HTMLButtonElement>(null);

  const handleMouseMove = (e: MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <Component
      ref={cardRef as any}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden card-gradient backdrop-blur-xl rounded-3xl border-0 group ${className} ${onClick ? 'cursor-pointer text-left' : ''}`}
    >
      {/* Spotlight Effect Layer */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300 ease-in-out"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${orbColor1}, transparent 40%)`,
        }}
      />

      {/* Content Layer */}
      <div className="relative z-10 h-full w-full">{children}</div>
    </Component>
  );
}
