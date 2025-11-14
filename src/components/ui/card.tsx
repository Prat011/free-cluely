/**
 * Card Component - Reusable card with beautiful styling
 */

import React from 'react'
import { cn } from '../../lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('rounded-lg', className)} {...props}>
      {children}
    </div>
  )
}

export default Card
