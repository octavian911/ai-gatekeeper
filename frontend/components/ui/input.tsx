import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={`w-full px-3 py-2 bg-background border-2 border-border rounded-md text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-border-strong ${className || ""}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
