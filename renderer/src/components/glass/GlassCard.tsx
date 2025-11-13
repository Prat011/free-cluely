/**
 * Horalix Halo - GlassCard Component
 *
 * Premium glassmorphism card with blur effects and gradients.
 * The foundation of Horalix Halo's visual design.
 */

import React from "react"
import { cn } from "../../lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "strong" | "glow"
  blur?: "sm" | "md" | "lg" | "xl"
  padding?: "none" | "sm" | "md" | "lg"
  hover?: boolean
  animated?: boolean
}

const variantStyles = {
  default:
    "bg-white/10 dark:bg-slate-900/30 border border-white/20 dark:border-white/10",
  subtle:
    "bg-white/5 dark:bg-slate-900/20 border border-white/10 dark:border-white/5",
  strong:
    "bg-white/20 dark:bg-slate-900/40 border border-white/30 dark:border-white/15",
  glow:
    "bg-gradient-to-br from-halo-purple-500/10 via-halo-indigo-500/10 to-halo-teal-500/10 border border-halo-purple-500/20 shadow-glow",
}

const blurStyles = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
}

const paddingStyles = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      variant = "default",
      blur = "md",
      padding = "md",
      hover = false,
      animated = true,
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
          "rounded-xl shadow-glass transition-all duration-300",
          // Variant
          variantStyles[variant],
          // Blur
          blurStyles[blur],
          // Padding
          paddingStyles[padding],
          // Hover effect
          hover &&
            "hover:shadow-glass-lg hover:scale-[1.02] hover:bg-white/15 dark:hover:bg-slate-900/35 cursor-pointer",
          // Animations
          animated && "animate-fade-in",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

GlassCard.displayName = "GlassCard"
