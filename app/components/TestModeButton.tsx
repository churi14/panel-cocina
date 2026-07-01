"use client";
import React, { useState } from 'react';
import { useTestMode } from './TestModeContext';
import { FlaskConical, Trash2, RefreshCw, X } from 'lucide-react';

export default function TestModeButton() {
  const { isTestMode, sessionId, activarTestMode, limpiarTestMode } = useTestMode();
  const [limpiando, setLimpiando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; detalle: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLimpiar = async () => {
    setShowConfirm(false);
    setLimpiando(true);
    setResultado(null);
    const res = await limpiarTestMode();
    setResultado(res);
    setLimpiando(false);
  };

  return (
    <>
      {/* Banner de modo test — visible en toda la app */}
      {isTestMode && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-400 text-slate-900 text-xs font-black text-center py-1.5 flex items-center justify-center gap-3">
          <FlaskConical size={14} />
          MODO TEST ACTIVO — Los cambios no son reales y se pueden borrar
          <button
            onClick={() => setShowConfirm(true)}
            className="bg-slate-900 text-amber-400 px-3 py-0.5 rounded-full text-xs font-black hover:bg-slate-700 transition-all"
          >
            Limpiar y salir
          </button>
        </div>
      )}

      {/* Botón en admin */}
      {!isTestMode ? (
        <button
          onClick={() => activarTestMode()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-black transition-all"
        >
          <FlaskConical size={14} />
          Activar modo test
        </button>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={limpiando}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-black transition-all disabled:opacity-50"
        >
          {limpiando
            ? <><RefreshCw size={14} className="animate-spin" /> Limpiando...</>
            : <><Trash2 size={14} /> Limpiar todo y salir del test</>
          }
        </button>
      )}

      {/* Resultado de limpieza */}
      {resultado && (
        <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-bold flex items-start gap-2
          ${resultado.ok ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          <span>{resultado.ok ? '✓' : '✕'}</span>
          <span>{resultado.detalle}</span>
          <button onClick={() => setResultado(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      {/* Modal de confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-3">🧪</div>
              <h2 className="font-black text-white text-lg">¿Limpiar todo el test?</h2>
              <p className="text-slate-400 text-sm mt-2">
                Se van a borrar todas las producciones, movimientos y eventos generados en esta sesión de prueba. El stock va a volver al estado anterior.
              </p>
              {sessionId && (
                <p className="text-xs text-slate-600 mt-2 font-mono">{sessionId}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleLimpiar}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-sm"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}