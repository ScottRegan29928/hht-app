import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Expand } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  photos: string[];
  alt: string;
}

export function PhotoGallery({ photos, alt }: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="h-80 sm:h-[28rem] rounded-2xl bg-gradient-to-br from-primary/10 to-accent/5 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No photos available</p>
      </div>
    );
  }

  const next = () => setCurrentIndex((i) => (i + 1) % photos.length);
  const prev = () =>
    setCurrentIndex((i) => (i - 1 + photos.length) % photos.length);

  return (
    <>
      {/* Main gallery */}
      <div className="relative group">
        {/* Large photo */}
        <div className="relative h-80 sm:h-[28rem] rounded-2xl overflow-hidden bg-muted">
          <img
            src={photos[currentIndex]}
            alt={`${alt} - Photo ${currentIndex + 1}`}
            className="w-full h-full object-cover"
          />
          {/* Expand button */}
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
          >
            <Expand className="w-4 h-4" />
          </button>
          {/* Counter */}
          <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/50 text-white text-xs font-medium rounded-full backdrop-blur-sm">
            {currentIndex + 1} / {photos.length}
          </div>
          {/* Nav arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {photos.slice(0, 8).map((photo, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all",
                  i === currentIndex
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent hover:border-border opacity-70 hover:opacity-100"
                )}
              >
                <img
                  src={photo}
                  alt={`Thumbnail ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
            {photos.length > 8 && (
              <button
                onClick={() => setLightboxOpen(true)}
                className="shrink-0 w-20 h-14 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                +{photos.length - 8} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="absolute top-4 left-4 text-white/70 text-sm">
            {currentIndex + 1} / {photos.length}
          </div>
          <img
            src={photos[currentIndex]}
            alt={`${alt} - Photo ${currentIndex + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain"
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
