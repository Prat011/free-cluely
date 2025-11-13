/**
 * Horalix Halo - GlassInput Component
 *
 * Premium input field with glassmorphism.
 */

import React from "react"
import { cn } from "../../lib/utils"

export interface GlassInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  error?: boolean
  helperText?: string
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      className,
      leftIcon,
      rightIcon,
      error = false,
      helperText,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              // Base styles
              "w-full rounded-xl px-4 py-2.5",
              "bg-white/10 dark:bg-slate-800/30",
              "border backdrop-blur-md",
              "text-slate-900 dark:text-white placeholder-slate-500",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent",
              // States
              error
                ? "border-red-500/50 focus:border-red-500 focus:ring-red-500"
                : "border-white/20 dark:border-white/10 focus:border-halo-purple-500 focus:ring-halo-purple-500",
              // Icons
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {helperText && (
          <p
            className={cn(
              "mt-1 text-sm",
              error ? "text-red-500" : "text-slate-500 dark:text-slate-400"
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

GlassInput.displayName = "GlassInput"

// ============================================================================
// GLASS TEXTAREA
// ============================================================================

export interface GlassTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  helperText?: string
}

export const GlassTextarea = React.forwardRef<
  HTMLTextAreaElement,
  GlassTextareaProps
>(({ className, error = false, helperText, ...props }, ref) => {
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        className={cn(
          // Base styles
          "w-full rounded-xl px-4 py-2.5",
          "bg-white/10 dark:bg-slate-800/30",
          "border backdrop-blur-md",
          "text-slate-900 dark:text-white placeholder-slate-500",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent",
          "resize-none",
          // States
          error
            ? "border-red-500/50 focus:border-red-500 focus:ring-red-500"
            : "border-white/20 dark:border-white/10 focus:border-halo-purple-500 focus:ring-halo-purple-500",
          className
        )}
        {...props}
      />
      {helperText && (
        <p
          className={cn(
            "mt-1 text-sm",
            error ? "text-red-500" : "text-slate-500 dark:text-slate-400"
          )}
        >
          {helperText}
        </p>
      )}
    </div>
  )
})

GlassTextarea.displayName = "GlassTextarea"
