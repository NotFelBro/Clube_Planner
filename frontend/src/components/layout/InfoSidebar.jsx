import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import BrandLogo from "../brand/BrandLogo.jsx";
import { siteSections } from "../../data/siteSections.js";

export default function InfoSidebar() {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  function close() {
    dialogRef.current?.close();
  }

  function show() {
    dialogRef.current?.showModal();
    setOpen(true);
    dialogRef.current?.querySelector("button")?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Abrir menu de informações"
        aria-haspopup="dialog"
        aria-controls="store-info-sidebar"
        aria-expanded={open}
        onClick={show}
        className="my-1 inline-flex h-11 w-11 shrink-0 items-center justify-center self-center justify-self-start rounded-lg text-slatebrand transition hover:bg-softsage"
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        id="store-info-sidebar"
        aria-labelledby="store-info-title"
        onClose={() => { setOpen(false); triggerRef.current?.focus(); }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = [...event.currentTarget.querySelectorAll("button, a[href], summary")]
            .filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
        }}
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(340px,calc(100vw-24px))] max-w-none border-0 bg-sand p-0 text-slatebrand shadow-2xl backdrop:bg-slatebrand/50"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-5">
            <h2 id="store-info-title" className="font-display text-lg font-semibold">Informações</h2>
            <button type="button" onClick={close} aria-label="Fechar menu de informações" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-softsage">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
            <Link to="/loja" onClick={close} aria-label="Clube Planner — página inicial" className="mb-8 block w-60 max-w-full">
              <BrandLogo />
            </Link>
            <div className="space-y-2">
              {siteSections.map((section) => (
                <details key={section.id} className="group border-b border-line">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-3 py-4 text-sm font-semibold transition hover:bg-softsage [&::-webkit-details-marker]:hidden">
                    {section.title}
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"><path d="m6 9 6 6 6-6" /></svg>
                  </summary>
                  <ul className="space-y-3 px-4 pb-5 pt-1 text-sm leading-6 text-muted">
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
