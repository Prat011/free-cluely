/**
 * Horalix Halo - GlassButton Component
 *
 * Premium button with glassmorphism and gradient effects.
 */

import React from "react"
import { cn } from "../../lib/utils"

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  icon?: React.ReactNode
  iconPosition?: "left" | "right"
  loading?: boolean
  glow?: boolean
}

const variantStyles = {
  default:
    "bg-white/10 dark:bg-slate-800/30 hover:bg-white/20 dark:hover:bg-slate-800/40 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white",
  primary:
    "bg-gradient-to-r from-halo-purple-500 to-halo-indigo-500 hover:from-halo-purple-600 hover:to-halo-indigo-600 text-white border border-halo-purple-400/50 shadow-glow",
  ghost:
    "bg-transparent hover:bg-white/10 dark:hover:bg-slate-800/20 border border-transparent hover:border-white/10 text-slate-900 dark:text-white",
  danger:
    "bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-600 dark:text-red-400",
}

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-base rounded-xl",
  lg: "px-6 py-3 text-lg rounded-xl",
}

export const GlassButton = React.forwardRef<
  HTMLButtonElement,
  GlassButtonProps
>(
  (
    {
      className,
      variant = "default",
      size = "md",
      icon,
      iconPosition = "left",
      loading = false,
      glow = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center gap-2 font-medium",
          "backdrop-blur-md transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-halo-purple-500 focus:ring-offset-2 focus:ring-offset-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          // Variant
          variantStyles[variant],
          // Size
          sizeStyles[size],
          // Hover effects
          "hover:scale-105 active:scale-95",
          // Glow
          glow && "shadow-glow hover:shadow-glow-lg animate-glow-pulse",
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && icon && iconPosition === "left" && icon}
        {children}
        {!loading && icon && iconPosition === "right" && icon}
      </button>
    )
  }
)

GlassButton.displayName = "GlassButton"
