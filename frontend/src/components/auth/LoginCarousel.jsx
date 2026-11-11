import { useEffect, useRef, useState } from "react";

export default function LoginCarousel({ slides }) {
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointerStart = useRef(null);
  const count = slides.length;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (count < 2 || focused || hovered || reducedMotion) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % count), 3000);
    return () => window.clearInterval(timer);
  }, [count, focused, hovered, reducedMotion]);

  function move(direction) {
    setActive((index) => (index + direction + count) % count);
  }

  return (
    <section
      aria-label="Inspirações de papelaria"
      aria-roledescription="carrossel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
      className="mx-auto w-full max-w-[490px]"
    >
      <div
        className="overflow-hidden rounded-2xl border border-white/15 bg-[#2e3356] shadow-lg"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY }; }}
        onPointerUp={(event) => {
          const start = pointerStart.current;
          pointerStart.current = null;
          if (!start) return;
          const distance = event.clientX - start.x;
          if (Math.abs(distance) > 45 && Math.abs(distance) > Math.abs(event.clientY - start.y)) move(distance < 0 ? 1 : -1);
        }}
        onPointerCancel={() => { pointerStart.current = null; }}
      >
        <div className="relative aspect-[3/2]">
          {slides.map((slide, index) => (
            <div key={slide.src} role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${count}`} aria-hidden={index !== active} className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${index === active ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              <img src={slide.src} alt={slide.alt} width="1536" height="1024" loading={index === 0 ? "eager" : "lazy"} decoding="async" draggable="false" className="h-full w-full object-contain" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center" aria-label="Escolher imagem">
        {slides.map((slide, index) => <button key={slide.src} type="button" aria-label={`Ver imagem ${index + 1}`} aria-pressed={index === active} onClick={() => setActive(index)} className="flex h-11 w-9 items-center justify-center"><span aria-hidden="true" className={`h-2 rounded-full transition-all motion-reduce:transition-none ${index === active ? "w-6 bg-terracotta" : "w-2 bg-white/35"}`} /></button>)}
      </div>
      <p className="sr-only" aria-live={focused || hovered ? "polite" : "off"}>{slides[active]?.alt}</p>
    </section>
  );
}
