"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, HelpCircle } from "lucide-react";

type Step = {
  targetId?: string;
  title: string;
  body: string | React.ReactNode;
  position?: "top" | "bottom" | "left" | "right" | "auto";
};

const STEPS: Step[] = [
  {
    title: "👋 Bienvenido al Panel Admin",
    body: "Este tour te explica cómo usar cada sección del panel de administración.\n\nTarda menos de 3 minutos. Tocá SIGUIENTE para arrancar.",
  },
  {
    targetId: "admin-tour-header",
    title: "🔝 Barra superior",
    body: (
      <div>
        <p className="mb-3">Desde acá podés:</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <p>🔔 Ver notificaciones en tiempo real</p>
          <p>🔔 Activar/desactivar push notifications</p>
          <p>🔄 Refrescar todos los datos</p>
          <p>🍳 Ir a la vista de cocina</p>
          <p>🚪 Cerrar sesión</p>
        </div>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "admin-tour-tab-dashboard",
    title: "📊 Dashboard",
    body: (
      <div>
        <p className="mb-3">La pantalla principal. Muestra de un vistazo:</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <p>🟢 <strong>Producciones activas</strong> ahora mismo</p>
          <p>📈 Estadísticas del día (ingresos, egresos)</p>
          <p>⚡ Actividad en tiempo real</p>
          <p>📋 Últimos 10 movimientos de stock</p>
        </div>
        <p className="mt-3 text-xs text-white/60">La actividad se actualiza sola sin necesidad de refrescar.</p>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "admin-tour-tab-movements",
    title: "📦 Movimientos",
    body: (
      <div>
        <p className="mb-3">Historial completo de todos los movimientos de stock:</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <p>🟢 <strong>Ingresos</strong> — mercadería que entró</p>
          <p>🔴 <strong>Egresos</strong> — lo que se usó o descontó</p>
          <p>⚙️ <strong>Ajustes</strong> — correcciones manuales</p>
        </div>
        <p className="mt-3 text-sm">Podés filtrar por tipo, operador y fecha. Exportable a Excel.</p>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "admin-tour-tab-stock",
    title: "🏪 Stock",
    body: (
      <div>
        <p className="mb-3">Estado actual de todos los materiales e ingredientes.</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <p>• Configurá umbrales de alerta por producto</p>
          <p>• Ve qué está crítico o por agotarse</p>
          <p>• Configurá tus alertas personales</p>
          <p>• Historial de cada ítem</p>
        </div>
        <p className="mt-3 text-sm text-amber-300 font-bold">⚠️ Los productos en rojo necesitan reposición urgente.</p>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "admin-tour-tab-produccion",
    title: "🍔 Producción",
    body: (
      <div>
        <p className="mb-3">Stock de producción — lo que ya está listo para vender:</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <p>🥩 Lomito, burger, milanesa</p>
          <p>🍞 Pan, salsas, dips</p>
          <p>🧀 Fiambres preparados, verduras</p>
        </div>
        <p className="mt-3 text-sm">Hacé click en cualquier producto para ver el historial de producciones y el gráfico de tendencia.</p>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "admin-tour-tab-analytics",
    title: "📈 Analytics",
    body: (
      <div>
        <p className="mb-3">Análisis profundo de la operación:</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <p>📊 Producción por período</p>
          <p>⏱️ Tiempos promedio por receta</p>
          <p>👤 Rendimiento por operador</p>
          <p>📉 Desperdicios y mermas</p>
        </div>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "admin-tour-tab-usuarios",
    title: "👤 Usuarios",
    body: (
      <div>
        <p className="mb-3">Gestión de todos los accesos al sistema:</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <p>➕ Crear nuevos operadores o admins</p>
          <p>✏️ Editar nombre, contraseña y rol</p>
          <p>🔕 Desactivar usuarios temporalmente</p>
          <p>🗑️ Eliminar usuarios definitivamente</p>
          <p>🔔 Mandar notificaciones push individuales</p>
        </div>
        <p className="mt-3 text-xs text-amber-300 font-bold">Cada operador tiene su propio login — así los registros quedan atribuidos correctamente.</p>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "admin-tour-tab-operadores",
    title: "🏆 Operadores",
    body: (
      <div>
        <p className="mb-3">Ranking y estadísticas individuales por operador:</p>
        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm">
          <p>🥇 Quién produjo más esta semana</p>
          <p>⏱️ Tiempos promedio por operador</p>
          <p>📊 Historial de turnos</p>
        </div>
      </div>
    ),
    position: "bottom",
  },
  {
    targetId: "admin-tour-tab-proyeccion",
    title: "🔮 Proyección",
    body: "Estimaciones de stock y producción para los próximos días basadas en el historial.\n\nTe ayuda a planificar compras y evitar quedarte sin nada.",
    position: "bottom",
  },
  {
    title: "✅ ¡Listo! Ya conocés el panel admin",
    body: "Si necesitás volver a ver este tour, tocá el botón\n\n❓\n\nque aparece abajo a la derecha.\n\n¡Cualquier duda consultá al equipo! 🚀",
  },
];

const LS_KEY = "tour_admin_done_v1";

function getRect(id: string): DOMRect | null {
  if (typeof window === "undefined") return null;
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect() : null;
}

const PAD = 10;

export default function AdminTour() {
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [arrowSide, setArrowSide] = useState<"top" | "bottom" | "left" | "right" | "none">("none");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const done = localStorage.getItem(LS_KEY);
    if (!done) {
      setTimeout(() => setActive(true), 1000);
    }
  }, []);

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
    const POPOVER_H = 300;
    const GAP = 16;

    const desiredPos = currentStep.position ?? "auto";
    const spaceTop    = r.top - PAD;
    const spaceBottom = vh - r.bottom - PAD;
    const spaceRight  = vw - r.right - PAD;

    let pos = desiredPos;
    if (pos === "auto") {
      if (spaceBottom >= POPOVER_H + GAP) pos = "bottom";
      else if (spaceTop >= POPOVER_H + GAP) pos = "top";
      else if (spaceRight >= POPOVER_W + GAP) pos = "right";
      else pos = "left";
    }

    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    let style: React.CSSProperties = {};

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

  useEffect(() => {
    if (!active) return;
    const id = STEPS[step]?.targetId;
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active, step]);

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const finish = () => {
    localStorage.setItem(LS_KEY, "1");
    setActive(false);
    setStep(0);
  };

  const relaunch = () => { setStep(0); setActive(true); };

  const isLast = step === STEPS.length - 1;
  const currentStep = STEPS[step];
  const isCentered = !currentStep.targetId;

  if (!active) {
    return (
      <button onClick={relaunch} id="admin-tour-help-btn" title="Ver tutorial"
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-full shadow-xl flex items-center justify-center border border-slate-600 transition-all hover:scale-110 active:scale-95">
        <HelpCircle size={22} />
      </button>
    );
  }

  return (
    <>
      {/* Overlay con spotlight */}
      <div className="fixed inset-0 z-[9000] pointer-events-none">
        {rect && !isCentered ? (
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="admin-spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect x={rect.left - PAD} y={rect.top - PAD}
                  width={rect.width + PAD * 2} height={rect.height + PAD * 2}
                  rx={12} fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.80)" mask="url(#admin-spotlight-mask)" />
            <rect x={rect.left - PAD} y={rect.top - PAD}
              width={rect.width + PAD * 2} height={rect.height + PAD * 2}
              rx={12} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/80" />
        )}
      </div>

      {/* Bloquear interacción */}
      <div className="fixed inset-0 z-[9001] pointer-events-auto" />

      {/* Popover */}
      <div ref={popoverRef} className="fixed z-[9002] pointer-events-auto" style={{ width: 340, ...popoverStyle }}>
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

        <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="font-black text-white text-base leading-tight">{currentStep.title}</h3>
            <button onClick={finish} className="text-slate-500 hover:text-white transition-colors ml-3 shrink-0">
              <X size={16} />
            </button>
          </div>

          <div className="px-5 pb-4 text-slate-300 text-sm leading-relaxed">
            {typeof currentStep.body === "string"
              ? currentStep.body.split("\n").map((line, i) => (
                  <p key={i} className={line === "" ? "h-2" : ""}>{line}</p>
                ))
              : currentStep.body}
          </div>

          <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
            <span className="text-slate-500 text-xs">{step + 1} de {STEPS.length}</span>
            <div className="flex items-center gap-3">
              {!isLast && (
                <button onClick={finish} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
                  Saltar tour
                </button>
              )}
              <button onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-black text-sm rounded-xl transition-all active:scale-95">
                {isLast ? "¡Entendido!" : "Siguiente"}
                {!isLast && <ChevronRight size={16} />}
              </button>
            </div>
          </div>

          <div className="h-1 bg-slate-700">
            <div className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </div>
    </>
  );
}