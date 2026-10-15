import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from "react";
import type { IslandMap as IslandMapType } from "./IslandMap";

// Perf [2026-10-15]: mapbox-gl (~1.6 MB raw) used to sit in the main bundle and
// the map initialised on page load, fetching tiles before first paint on
// mobile. This wrapper loads the real map only when its box nears the
// viewport. The placeholder keeps the exact same box (w-full, same height,
// rounded-xl) so layout does not shift.
const IslandMapImpl = lazy(() =>
  import("./IslandMap").then((m) => ({ default: m.IslandMap })),
);

type Props = ComponentProps<typeof IslandMapType>;

export function IslandMap(props: Props) {
  const height = props.height ?? "500px";
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    // Load when the box is near the viewport AND the page has settled: on the
    // first user interaction, or ~5 s after window load. On hht/spicebush/
    // swallowtail the map sits at the fold, so loading it immediately cost
    // ~6 s of main-thread time on mobile before the page became usable.
    let near = typeof IntersectionObserver === "undefined";
    let settled = false;
    const tryShow = () => { if (near && settled) setShow(true); };
    const settle = () => { settled = true; tryShow(); };
    const evts = ["scroll", "pointerdown", "touchstart", "keydown", "wheel", "mousemove"] as const;
    evts.forEach((e) => window.addEventListener(e, settle, { once: true, passive: true }));
    let timer: number | undefined;
    const arm = () => { timer = window.setTimeout(settle, 5000); };
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });
    let io: IntersectionObserver | undefined;
    if (!near) {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) { near = true; io?.disconnect(); tryShow(); }
        },
        { rootMargin: "400px 0px" },
      );
      io.observe(el);
    } else tryShow();
    return () => {
      io?.disconnect();
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("load", arm);
      evts.forEach((e) => window.removeEventListener(e, settle));
    };
  }, [show]);
  const placeholder = <div ref={ref} style={{ height }} className="w-full rounded-xl" />;
  if (!show) return placeholder;
  return (
    <Suspense fallback={<div style={{ height }} className="w-full rounded-xl" />}>
      <IslandMapImpl {...props} />
    </Suspense>
  );
}
