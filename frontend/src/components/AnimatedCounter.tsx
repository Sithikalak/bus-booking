import { useEffect, useState, useRef } from "react";

interface AnimatedCounterProps {
  value?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1600,
  prefix = "",
  suffix = "",
  className = "",
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value === undefined || value === null) return;
    if (value === 0) {
      setCount(0);
      return;
    }

    const node = elementRef.current;
    if (!node) return;

    let frameId: number | null = null;

    const startCountAnimation = () => {
      let startTimestamp: number | null = null;
      const startValue = 0;
      const endValue = value;

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic: 1 - pow(1 - progress, 3)
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(ease * (endValue - startValue) + startValue);

        setCount(current);

        if (progress < 1) {
          frameId = requestAnimationFrame(step);
        } else {
          setCount(endValue);
        }
      };

      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Re-animate every time element enters the viewport
            startCountAnimation();
          } else {
            // Reset to 0 when scrolled out of view so it can animate on next scroll
            if (frameId) {
              cancelAnimationFrame(frameId);
              frameId = null;
            }
            setCount(0);
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [value, duration]);

  if (value === undefined || value === null) {
    return (
      <span
        ref={elementRef}
        className={`counter-skeleton ${className}`.trim()}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      ref={elementRef}
      className={`counter-number ${className}`.trim()}
    >
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}
