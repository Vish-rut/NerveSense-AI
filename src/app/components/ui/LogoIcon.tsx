import React from "react";

interface LogoIconProps {
  className?: string;
}

export function LogoIcon({ className = "" }: LogoIconProps) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 60" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="100" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect 
        x="5" 
        y="5" 
        width="90" 
        height="50" 
        rx="25" 
        stroke="url(#logo-gradient)" 
        strokeWidth="10" 
      />
      <circle 
        cx="35" 
        cy="30" 
        r="7" 
        fill="url(#logo-gradient)" 
      />
      <circle 
        cx="65" 
        cy="30" 
        r="7" 
        fill="url(#logo-gradient)" 
      />
    </svg>
  );
}
