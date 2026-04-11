"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, HelpCircle } from "lucide-react";

// ─── PASOS DEL TOUR ──────────────────────────────────────────────────────────

type Step = {
  targetId?: string;        // ID del elemento a iluminar (undefined = modal centrado)
  title: string;
  body: string | React.ReactNode;
  position?: "top" | "bottom" | "left" | "right" | "auto";
};

const STEPS: Step[] = [
  {
    title: "👋 Bienvenido al Panel de Cocina",
    body: "Este tour te explica cómo usar el sistema paso a paso.\n\nTarda menos de 2 minutos y te ahorra muchas dudas después. Tocá SIGUIENTE para arrancar.",
  },
  {
    targetId: "tour-logo",
    title: "🍽️ La Cocina — Panel de Operadores",
    body: "Este es el sistema de gestión de La Cocina Dark Kitchen.\n\nDesde acá registrás todo lo que producís durante el turno: carnes, salsas, verduras y stock.",
    position: "right",
  },
  {
    targetId: "tour-nav-recetario",
    title: "📖 Recetario",
    body: "Acá están todas las recetas del local: ingredientes, cantidades y pasos.\n\nPodés consultarlo en cualquier momento para ver cómo se hace algo. No hace falta para registrar producción.",
    position: "right",
  },
  {
    targetId: "tour-card-carniceria",
    title: "🥩 Carnicería",
    body: (
      <div>
        <p className="mb-3">Acá registrás cuando trabajás con carne: <strong>lomito, burger y milanesa</strong>.</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1 text-sm">
          <p><span className="font-black text-rose-300">Paso 1</span> → Tocás ABRIR CARNICERÍA</p>
          <p><span className="font-black text-rose-300">Paso 2</span> → Elegís el tipo de corte</p>
          <p><span className="font-black text-rose-300">Paso 3</span> → Pesás la carne y cargás el peso</p>
          <p><span className="font-black text-rose-300">Paso 4</span> → El sistema toma el tiempo solo</p>
          <p><span className="font-black text-rose-300">Paso 5</span> → Cuando terminás, cerrás la producción</p>
        </div>
        <p className="mt-3 text-xs text-white/60">Si hay una producción en curso, el botón cambia a VER PRODUCCIONES y se pone en rojo.</p>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "tour-card-cocina",
    title: "🍳 Cocina General",
    body: (
      <div>
        <p className="mb-3">Para todo lo que no es carne: <strong>salsas, verduras cortadas, pan y menjunje para milanesas</strong>.</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1 text-sm">
          <p>• Criolla, Mayo Mila, Napolitana, Salsa Club...</p>
          <p>• Tomate, lechuga, cebolla brunoise...</p>
          <p>• Pan de lomito, pan sanguchero...</p>
        </div>
        <p className="mt-3 text-sm">Elegís la receta, ponés la cantidad y el sistema descuenta los ingredientes del stock <strong>automáticamente</strong>.</p>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "tour-card-stock-entry",
    title: "📦 Cargar Stock / Facturas",
    body: (
      <div>
        <p className="mb-3">Usá esto cuando <strong>llega mercadería nueva</strong> al local.</p>
        <div className="bg-white/10 rounded-xl p-3 text-sm space-y-1">
          <p className="font-bold text-white/80">Ejemplo:</p>
          <p>Llegaron 10kg de tomate →</p>
          <p>Buscás "tomate" → Ponés 10 → Guardás ✓</p>
        </div>
        <p className="mt-3 text-sm text-amber-300 font-bold">⚠️ Importante: hacelo siempre que llegue algo. Si no, el stock queda desactualizado y el admin no sabe qué hay.</p>
      </div>
    ),
    position: "top",
  },
  {
    targetId: "tour-card-stock-exit",
    title: "📉 Uso Manual / Mermas",
    body: (
      <div>
        <p className="mb-3">Para cuando <strong>usaste o tiraste algo sin pasar por una receta</strong>.</p>
        <div className="bg-white/10 rounded-xl p-3 text-sm space-y-1">
          <p className="font-bold text-white/80">Ejemplos:</p>
          <p>• Se rompió un frasco de salsa</p>
          <p>• Tiraste verdura que se pudrió</p>
          <p>• Usaste condimento suelto</p>
          <p>• Probaste y descartaste algo</p>
        </div>
        <p className="mt-3 text-sm text-amber-300 font-bold">⚠️ Siempre anotalo. Así el admin sabe exactamente qué se perdió y puede controlarlo.</p>
      </div>
    ),
    position: "top",
  },
  {
    targetId: "tour-card-stock-view",
    title: "📊 Ver Stock",
    body: (
      <div>
        <p className="mb-3">Muestra <strong>cuánto hay de cada cosa</strong> en este momento.</p>
        <div className="bg-white/10 rounded-xl p-3 text-sm space-y-2">
          <p><span className="text-red-400 font-black">ROJO</span> → Stock crítico o agotado. Avisale al encargado YA.</p>
          <p><span className="text-amber-400 font-black">AMARILLO</span> → Stock bajo. Hay que reponer pronto.</p>
          <p><span className="text-green-400 font-black">VERDE</span> → Todo bien.</p>
        </div>
        <p className="mt-3 text-sm">Revisalo antes de empezar el turno para saber con qué contás.</p>
      </div>
    ),
    position: "top",
  },
  {
    targetId: "tour-logout",
    title: "🚪 Cerrar Sesión",
    body: "Cuando terminás tu turno, tocá CERRAR SESIÓN.\n\nNo dejes la sesión abierta — el siguiente operador necesita entrar con su propio usuario para que los registros queden bien.",
    position: "top",
  },
  {
    title: "✅ ¡Listo! Ya sabés usar el sistema",
    body: "Si en algún momento necesitás volver a ver este tour, tocá el botón\n\n❓\n\nque aparece abajo a la derecha de la pantalla.\n\n¡Buena producción! 🍔",
  },
];

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

const LS_KEY = "tour_cocina_done_v1";

function getRect(id: string): DOMRect | null {
  if (typeof window === "undefined") return null;
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect() : null;
}

const PAD = 10; // padding alrededor del spotlight

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function KitchenTour() {
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [arrowSide, setArrowSide] = useState<"top" | "bottom" | "left" | "right" | "none">("none");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Arrancar tour automáticamente la primera vez
  useEffect(() => {
    const done = localStorage.getItem(LS_KEY);
    if (!done) {
      // Pequeño delay para que el DOM esté listo
      setTimeout(() => setActive(true), 800);
    }
  }, []);

  // Calcular posición del spotlight y popover cuando cambia el step
  const computeLayout = useCallback(() => {
    const currentStep = STEPS[step];
    if (!currentStep.targetId) {
      setRect(null);
      setPopoverStyle({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      setArrowSide("none");
      return;
    }

    const r = getRect(currentStep.targetId);
    if (!r) {
      setRect(null);
      setPopoverStyle({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      setArrowSide("none");
      return;
    }

    setRect(r);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const POPOVER_W = 340;
    const POPOVER_H = 280; // estimado
    const GAP = 16;

    const desiredPos = currentStep.position ?? "auto";

    // Calcular mejor posición disponible
    const spaceTop    = r.top - PAD;
    const spaceBottom = vh - r.bottom - PAD;
    const spaceLeft   = r.left - PAD;
    const spaceRight  = vw - r.right - PAD;

    let pos = desiredPos;
    if (pos === "auto") {
      if (spaceBottom >= POPOVER_H + GAP) pos = "bottom";
      else if (spaceTop >= POPOVER_H + GAP) pos = "top";
      else if (spaceRight >= POPOVER_W + GAP) pos = "right";
      else pos = "left";
    }

    let style: React.CSSProperties = {};

    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;

    if (pos === "bottom") {
      let left = centerX - POPOVER_W / 2;
      left = Math.max(12, Math.min(vw - POPOVER_W - 12, left));
      style = { top: r.bottom + PAD + GAP, left };
      setArrowSide("top");
    } else if (pos === "top") {
      let left = centerX - POPOVER_W / 2;
      left = Math.max(12, Math.min(vw - POPOVER_W - 12, left));
      style = { bottom: vh - r.top + PAD + GAP, left };
      setArrowSide("bottom");
    } else if (pos === "right") {
      let top = centerY - POPOVER_H / 2;
      top = Math.max(12, Math.min(vh - POPOVER_H - 12, top));
      style = { left: r.right + PAD + GAP, top };
      setArrowSide("left");
    } else {
      let top = centerY - POPOVER_H / 2;
      top = Math.max(12, Math.min(vh - POPOVER_H - 12, top));
      style = { right: vw - r.left + PAD + GAP, top };
      setArrowSide("right");
    }

    setPopoverStyle(style);
  }, [step]);

  useEffect(() => {
    if (!active) return;
    computeLayout();
    window.addEventListener("resize", computeLayout);
    return () => window.removeEventListener("resize", computeLayout);
  }, [active, step, computeLayout]);

  // Scroll para que el elemento sea visible
  useEffect(() => {
    if (!active) return;
    const id = STEPS[step]?.targetId;
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, step]);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    localStorage.setItem(LS_KEY, "1");
    setActive(false);
    setStep(0);
  };

  const relaunch = () => {
    setStep(0);
    setActive(true);
  };

  const isLast = step === STEPS.length - 1;
  const currentStep = STEPS[step];
  const isCentered = !currentStep.targetId;

  if (!active) {
    // Botón flotante para relanzar
    return (
      <button
        onClick={relaunch}
        id="tour-help-btn"
        title="Ver tutorial"
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-xl flex items-center justify-center border border-slate-600 transition-all hover:scale-110 active:scale-95"
      >
        <HelpCircle size={22} />
      </button>
    );
  }

  return (
    <>
      {/* ── OVERLAY CON SPOTLIGHT ── */}
      <div className="fixed inset-0 z-[9000] pointer-events-none">
        {rect && !isCentered ? (
          // SVG clip-path spotlight
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={rect.left - PAD}
                  y={rect.top - PAD}
                  width={rect.width + PAD * 2}
                  height={rect.height + PAD * 2}
                  rx={16}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.75)"
              mask="url(#spotlight-mask)"
            />
            {/* Borde del spotlight */}
            <rect
              x={rect.left - PAD}
              y={rect.top - PAD}
              width={rect.width + PAD * 2}
              height={rect.height + PAD * 2}
              rx={16}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={2}
            />
          </svg>
        ) : (
          // Overlay sólido para pasos centrados
          <div className="absolute inset-0 bg-black/75" />
        )}
      </div>

      {/* Overlay clickeable para bloquear interacción */}
      <div className="fixed inset-0 z-[9001] pointer-events-auto" />

      {/* ── POPOVER ── */}
      <div
        ref={popoverRef}
        className="fixed z-[9002] pointer-events-auto"
        style={{ width: 340, ...popoverStyle }}
      >
        {/* Flecha */}
        {arrowSide === "top" && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderBottom: "10px solid #1e293b" }} />
        )}
        {arrowSide === "bottom" && (
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "10px solid #1e293b" }} />
        )}
        {arrowSide === "left" && (
          <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-0 h-0"
            style={{ borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderRight: "10px solid #1e293b" }} />
        )}
        {arrowSide === "right" && (
          <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-0 h-0"
            style={{ borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "10px solid #1e293b" }} />
        )}

        {/* Burbuja */}
        <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="font-black text-white text-base leading-tight">{currentStep.title}</h3>
            <button onClick={finish} className="text-slate-500 hover:text-white transition-colors ml-3 shrink-0">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 pb-4 text-slate-300 text-sm leading-relaxed">
            {typeof currentStep.body === "string"
              ? currentStep.body.split("\n").map((line, i) => (
                  <p key={i} className={line === "" ? "h-2" : ""}>{line}</p>
                ))
              : currentStep.body}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
            <span className="text-slate-500 text-xs">
              {step + 1} de {STEPS.length}
            </span>
            <div className="flex items-center gap-3">
              {!isLast && (
                <button onClick={finish} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
                  Saltar tour
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-black text-sm rounded-xl transition-all active:scale-95"
              >
                {isLast ? "¡Entendido!" : "Siguiente"}
                {!isLast && <ChevronRight size={16} />}
              </button>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="h-1 bg-slate-700">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}