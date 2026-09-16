import { useEffect, useRef } from "react";

/**
 * Horizontal ("side") parallax background layer.
 *
 * The old spicebushatseapines.com uses Avada's `fusion-parallax-left`, which
 * slides the photograph sideways as the section scrolls through the viewport
 * rather than holding it still. CSS cannot express that, so this is the smallest
 * honest version: an oversized image layer whose translateX is driven by the
 * section's scroll progress, updated inside requestAnimationFrame and torn down
 * on unmount. Visitors with prefers-reduced-motion get a static layer, and the
 * layer is wider than its container so no edge is ever exposed while it moves.
 */
export function SideParallaxImage({
  src,
  travel = 8,
  scrim = 0.45,
}: {
  /** Image URL. */
  src: string;
  /** How far the image slides, as a percentage of container width. */
  travel?: number;
  /** Black overlay opacity, 0 to 1. */
  scrim?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const layer = layerRef.current;
    if (!wrap || !layer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = wrap.getBoundingClientRect();
      const span = window.innerHeight + rect.height;
      if (span <= 0) return;
      // 0 when the section is just below the fold, 1 once it has fully passed.
      const progress = Math.min(Math.max((window.innerHeight - rect.top) / span, 0), 1);
      // Slides leftwards, as fusion-parallax-left does.
      layer.style.transform = `translate3d(${(-progress * travel).toFixed(3)}%, 0, 0)`;
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [travel]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        ref={layerRef}
        className="absolute inset-y-0 left-0"
        style={{
          // Extra width covers the full travel plus a margin.
          width: `${100 + travel * 2}%`,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "50% 50%",
          backgroundRepeat: "no-repeat",
          willChange: "transform",
        }}
      />
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${scrim})` }} />
    </div>
  );
}
