
import { useEffect, useState } from "react";
import { Link } from "react-router";

const banners = [
  {
    id: 1,
    image: "/banners/banner-01.webp",
    alt: "Coleção de papelaria Clube Planner",
  },
  {
    id: 2,
    image: "/banners/banner-02.webp",
    alt: "Planners, cadernos e acessórios de papelaria",
  },
  {
    id: 3,
    image: "/banners/banner-03.webp",
    alt: "Produtos para organização e criatividade",
  },
];

const SLIDE_INTERVAL = 5000;

export default function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
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
      aria-label="Destaques do Clube Planner"
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
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={
                index === 0 ? "high" : "auto"
              }
              className="h-full w-full object-cover object-center"
            />
          </div>
        ))}

        {/* Proteção de contraste para os textos */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#fae7de]/95 via-[#fae7de]/85 to-[#fae7de]/10" />
      </div>

      {/* Conteúdo fixo */}
      <div className="relative z-10 flex min-h-[310px] flex-col justify-center px-6 py-9 sm:min-h-[340px] sm:px-10 lg:min-h-[360px] lg:px-12">
        <div className="max-w-[560px]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-terracotta">
            Papelaria com afeto
          </p>

          <h1 className="mt-6 font-display text-[30px] font-semibold leading-[1.25] text-slatebrand sm:text-[38px] lg:text-[42px]">
            Planeje seus dias.
            <span className="block">
              Cultive suas ideias.
            </span>
          </h1>

          <p className="mt-5 max-w-[520px] text-sm leading-6 text-slatebrand sm:text-base">
            Planners, cadernos e pequenos detalhes para
            deixar sua rotina mais leve, bonita e
            organizada.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/colecoes"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-terracotta px-6 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Explorar coleção
            </Link>

            <Link
              to="/novidades"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-line bg-white px-6 text-sm font-semibold text-slatebrand transition hover:bg-softsage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Ver novidades
            </Link>
          </div>
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
