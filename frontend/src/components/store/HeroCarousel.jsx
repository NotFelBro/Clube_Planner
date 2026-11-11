
import { useEffect, useState } from "react";

const banners = [
  {
    id: 1,
    image: "/banners/banner-01.svg",
    alt: "Coleção de papelaria Clube Planner",
  },
  {
    id: 2,
    image: "/banners/banner-02.svg",
    alt: "Planners, cadernos e acessórios de papelaria",
  },
  {
    id: 3,
    image: "/banners/banner-03.svg",
    alt: "Produtos para organização e criatividade",
  },
];

const SLIDE_INTERVAL = 3000;

export default function HeroCarousel({
  compact = false,
  title = "Planeje seus dias.",
  subtitle = "Cultive suas ideias.",
  description = "Planners, cadernos e pequenos detalhes para deixar sua rotina mais leve, bonita e organizada.",
  label = "Destaques do Clube Planner",
  initialSlide = 0,
}) {
  const [activeIndex, setActiveIndex] = useState(initialSlide);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const updatePreference = () => {
      setReducedMotion(mediaQuery.matches);
    };

    updatePreference();

    mediaQuery.addEventListener(
      "change",
      updatePreference
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        updatePreference
      );
    };
  }, []);

  useEffect(() => {
    if (isPaused || reducedMotion || banners.length < 2) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((previous) =>
        (previous + 1) % banners.length
      );
    }, SLIDE_INTERVAL);

    return () => window.clearInterval(interval);
  }, [isPaused, reducedMotion]);

  return (
    <section
      aria-label={label}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setIsPaused(false);
        }
      }}
      className="relative isolate w-full overflow-hidden rounded-[22px] bg-[#fae7de]"
    >
      {/* Imagens animadas ao fundo */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity ease-in-out ${
              reducedMotion
                ? "duration-0"
                : "duration-[800ms]"
            } ${
              index === activeIndex
                ? "opacity-100"
                : "opacity-0"
            }`}
          >
            <img
              src={banner.image}
              alt=""
              loading={!compact && index === 0 ? "eager" : "lazy"}
              fetchPriority={!compact && index === 0 ? "high" : "auto"}
              className="h-full w-full object-cover object-center"
            />
          </div>
        ))}

        {/* Proteção de contraste para os textos */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#fae7de]/95 via-[#fae7de]/85 to-[#fae7de]/10" />
      </div>

      {/* Conteúdo fixo */}
      <div className={`relative z-10 flex flex-col justify-center ${compact
        ? "min-h-[200px] px-5 py-8 sm:min-h-[210px] sm:px-8 lg:min-h-[220px] lg:px-10"
        : "min-h-[310px] px-6 py-9 sm:min-h-[340px] sm:px-10 lg:min-h-[360px] lg:px-12"}`}>
        <div className="max-w-[560px]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-terracotta">
            Papelaria com afeto
          </p>

          {compact ? (
            <h3 className="mt-3 max-w-lg font-display text-xl font-semibold leading-tight text-slatebrand sm:text-2xl lg:text-3xl">{title}<span className="block">{subtitle}</span></h3>
          ) : (
            <h1 className="mt-6 font-display text-[30px] font-semibold leading-[1.25] text-slatebrand sm:text-[38px] lg:text-[42px]">{title}<span className="block">{subtitle}</span></h1>
          )}
          <p className={`${compact ? "mt-3 max-w-md text-xs sm:text-sm" : "mt-5 max-w-[520px] text-sm sm:text-base"} leading-6 text-slatebrand`}>{description}</p>


        </div>
      </div>

      {/* Indicadores do carrossel */}
      <div
        className="absolute bottom-4 right-5 z-20 flex items-center gap-2"
        aria-label="Selecionar imagem do banner"
      >
        {banners.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Mostrar banner ${index + 1}`}
            aria-pressed={activeIndex === index}
            className={`h-2 rounded-full transition-all duration-300 ${
              activeIndex === index
                ? "w-7 bg-terracotta"
                : "w-2 bg-slatebrand/35 hover:bg-terracotta/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
