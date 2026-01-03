import * as React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline";
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const variants = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-muted/30 text-foreground border border-border-strong",
    outline: "border border-border-strong text-foreground",
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
