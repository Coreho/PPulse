import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number   // ms, default 800
  decimals?: number   // decimal places, default 0
  suffix?: string     // e.g. '%'
  prefix?: string     // e.g. '$'
  style?: React.CSSProperties
  className?: string
}

export function AnimatedNumber({
  value, duration = 800, decimals = 0, suffix = '', prefix = '', style, className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const startValRef = useRef<number>(0)

  useEffect(() => {
    const startVal = display
    startRef.current = performance.now()
    startValRef.current = startVal
    cancelAnimationFrame(rafRef.current)

    const animate = (now: number) => {
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(startValRef.current + (value - startValRef.current) * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  const formatted = display.toFixed(decimals)
  return (
    <span style={style} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
