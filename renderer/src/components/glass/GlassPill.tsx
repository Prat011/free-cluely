/**
 * Horalix Halo - GlassPill Component
 *
 * Small pill-shaped components for mode badges, answer type chips, etc.
 */

import React from "react"
import { cn } from "../../lib/utils"

export interface GlassPillProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "primary" | "success" | "warning" | "info"
  size?: "sm" | "md"
  icon?: React.ReactNode
  removable?: boolean
  onRemove?: () => void
  active?: boolean
}

const variantStyles = {
  default:
    "bg-white/10 dark:bg-slate-800/30 border-white/20 dark:border-white/10 text-slate-900 dark:text-white",
  primary:
    "bg-halo-purple-500/20 border-halo-purple-500/30 text-halo-purple-700 dark:text-halo-purple-300",
  success:
    "bg-halo-teal-500/20 border-halo-teal-500/30 text-halo-teal-700 dark:text-halo-teal-300",
  warning:
    "bg-yellow-500/20 border-yellow-500/30 text-yellow-700 dark:text-yellow-300",
  info:
    "bg-halo-indigo-500/20 border-halo-indigo-500/30 text-halo-indigo-700 dark:text-halo-indigo-300",
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
}

export const GlassPill = React.forwardRef<HTMLDivElement, GlassPillProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      icon,
      removable = false,
      onRemove,
      active = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center gap-1.5 rounded-full",
          "backdrop-blur-md border font-medium",
          "transition-all duration-200",
          // Variant
          variantStyles[variant],
          // Size
          sizeStyles[size],
          // Active state
          active && "ring-2 ring-halo-purple-500 ring-offset-2 ring-offset-transparent scale-105",
          className
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
        {removable && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove?.()
            }}
            className="flex-shrink-0 ml-0.5 rounded-full hover:bg-white/20 p-0.5 transition-colors"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    )
  }
)

GlassPill.displayName = "GlassPill"
