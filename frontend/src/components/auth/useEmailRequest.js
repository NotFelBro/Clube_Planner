import { useEffect, useRef, useState } from "react";

// Trava síncrona evita dois submits antes do próximo render do React.
export default function useEmailRequest() {
  const emAndamento = useRef(false);
  const liberarEm = useRef(0);
  const [segundos, setSegundos] = useState(0);
  const aguardando = segundos > 0;
  useEffect(() => {
    if (!aguardando) return;
    const timer = setInterval(() => setSegundos(Math.max(0, Math.ceil((liberarEm.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [aguardando]);
  function iniciar() {
    if (emAndamento.current || Date.now() < liberarEm.current) return false;
    emAndamento.current = true;
    return true;
  }
  function concluir(enviado) {
    if (enviado) {
      liberarEm.current = Date.now() + 60000;
      setSegundos(60);
    }
    emAndamento.current = false;
  }
  return { iniciar, concluir, segundos };
}
