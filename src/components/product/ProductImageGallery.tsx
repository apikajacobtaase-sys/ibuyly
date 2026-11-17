 "use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

type ProductImage = { url: string; altText?: string | null };

export default function ProductImageGallery({
  images,
  title,
}: {
  images: ProductImage[];
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const imageList = images.filter((image) => Boolean(image.url));
  const activeImage = imageList[activeIndex];

  const close = useCallback(() => {
    setIsOpen(false);
    setZoomed(false);
  }, []);

  const previous = useCallback(() => {
    setActiveIndex((index) => (index - 1 + imageList.length) % imageList.length);
    setZoomed(false);
  }, [imageList.length]);

  const next = useCallback(() => {
    setActiveIndex((index) => (index + 1) % imageList.length);
    setZoomed(false);
  }, [imageList.length]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft" && imageList.length > 1) previous();
      if (event.key === "ArrowRight" && imageList.length > 1) next();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close, previous, next, imageList.length]);

  if (!activeImage) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-sm text-gray-400 lg:aspect-square">
        No product image available
      </div>
    );
  }

  return (
    <>
      <section className="w-full">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open product image viewer"
          className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm lg:aspect-square"
        >
          <Image
            src={activeImage.url}
            alt={activeImage.altText || title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 60vw"
            className="object-contain p-3 transition-transform duration-500 group-hover:scale-[1.03] sm:p-6"
          />
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 shadow-sm">
            <Maximize2 className="h-4 w-4" />
            View image
          </span>
          {imageList.length > 1 && (
            <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
              {activeIndex + 1} / {imageList.length}
            </span>
          )}
        </button>

        {imageList.length > 1 && (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {imageList.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`View product image ${index + 1}`}
                aria-pressed={activeIndex === index}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-gray-50 transition sm:h-24 sm:w-24 ${
                  activeIndex === index
                    ? "border-green-600 ring-2 ring-green-100"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <Image
                  src={image.url}
                  alt={image.altText || `${title} image ${index + 1}`}
                  fill
                  sizes="96px"
                  className="object-contain p-1"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} image viewer`}
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close image viewer"
            className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="absolute left-4 top-5 z-20 text-sm text-white/80">
            {activeIndex + 1} / {imageList.length}
          </div>

          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 p-2 backdrop-blur">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setZoomed((value) => !value);
              }}
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
              className="rounded-full p-2 text-white hover:bg-white/15"
            >
              {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
            </button>
            {imageList.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    previous();
                  }}
                  aria-label="Previous image"
                  className="rounded-full p-2 text-white hover:bg-white/15"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    next();
                  }}
                  aria-label="Next image"
                  className="rounded-full p-2 text-white hover:bg-white/15"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {imageList.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  previous();
                }}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  next();
                }}
                aria-label="Next image"
                className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          <div
            className="relative h-full w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={activeImage.url}
              alt={activeImage.altText || title}
              fill
              priority
              sizes="100vw"
              className={`transition-transform duration-300 ${
                zoomed ? "scale-150 cursor-zoom-out object-contain" : "scale-100 cursor-zoom-in object-contain"
              }`}
              onClick={() => setZoomed((value) => !value)}
            />
          </div>
        </div>
      )}
    </>
  );
}
