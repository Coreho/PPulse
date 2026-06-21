import type { CSSProperties } from 'react'

/** Apply to a container to animate children in with staggered fade-up */
export function staggerChild(index: number, baseDelay = 40): CSSProperties {
  return {
    animation: 'fadeUp 0.35s ease both',
    animationDelay: `${index * baseDelay}ms`,
  }
}

/** Fade-up a single element */
export const fadeUp: CSSProperties = {
  animation: 'fadeUp 0.3s ease both',
}

/** Scale-in (modal/card appear) */
export const scaleIn: CSSProperties = {
  animation: 'scaleIn 0.25s ease both',
}

/** Slide in from right */
export const slideInRight: CSSProperties = {
  animation: 'slideInRight 0.3s ease both',
}

/** Slide in from left */
export const slideInLeft: CSSProperties = {
  animation: 'slideInLeft 0.3s ease both',
}
