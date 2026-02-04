import React from "react";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  variant?: "light" | "dark" | "auto";
  size?: "sm" | "md" | "lg";
}

export function Logo({
  className = "",
  showTagline = false,
  variant = "auto",
  size = "md",
}: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  const frotasSizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  // Determine text colors based on variant
  const getTextColor = () => {
    if (variant === "light") return "text-white";
    if (variant === "dark") return "text-gray-900 dark:text-white";
    return "text-gray-900 dark:text-white";
  };

  const textColor = getTextColor();

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div className="flex items-baseline gap-1">
        {/* RS with transport industry gradient (Orange to Red) */}
        <span className={`${sizeClasses[size]} font-bold`}>
          <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
            RS
          </span>
        </span>
        {/* Frotas */}
        <span className={`${frotasSizeClasses[size]} font-bold ${textColor}`}>
          Frotas
        </span>
      </div>

      {showTagline && (
        <p className={`text-xs mt-2 ${textColor} opacity-80 font-medium`}>
          Gestão Inteligente de Frotas
        </p>
      )}
    </div>
  );
}
