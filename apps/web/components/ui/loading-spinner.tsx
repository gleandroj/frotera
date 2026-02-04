"use client";

interface LoadingSpinnerProps {
  text?: string;
  variant?: "fullscreen" | "inline" | "card";
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Loading spinner component for reuse
export const LoadingSpinner = ({
  text = "",
  variant = "fullscreen",
  size = "md",
  className = ""
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  const containerClasses = {
    fullscreen: "min-h-screen bg-background flex items-center justify-center",
    inline: "flex items-center justify-center py-4",
    card: "flex items-center justify-center py-8"
  };

  return (
    <div className={`${containerClasses[variant]} ${className}`}>
      <div className="text-center">
        <div className={`animate-spin rounded-full border-b-2 border-primary mx-auto mb-4 ${sizeClasses[size]}`}></div>
        {text && (
          <p className="text-foreground" suppressHydrationWarning>
            {text}
          </p>
        )}
      </div>
    </div>
  );
};
