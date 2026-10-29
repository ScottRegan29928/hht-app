import { lazy, Suspense, useEffect, useRef, useState } from "react";

const BeachDaySection = lazy(() => import("./BeachDaySection"));

/** Keep public-data calls and the section chunk off the initial hero paint. */
export function BeachDayLazy() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "400px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} style={{ minHeight: visible ? undefined : 600 }}>
    {visible && <Suspense fallback={<div style={{ minHeight: 600 }} />}><BeachDaySection /></Suspense>}
  </div>;
}
