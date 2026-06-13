"use client";
import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

type HelpItem = {
  pregunta: string;
  respuesta: string;
  tipo?: 'ok' | 'no' | 'info'; // ok = verde (esto SÍ), no = rojo (esto NO), info = azul
};

type Props = {
  titulo: string;
  items: HelpItem[];
};

export default function HelpButton({ titulo, items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Botón flotante — siempre visible, bien grande */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-[200] flex items-center gap-2 px-5 py-3.5
          bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-full
          shadow-[0_4px_20px_rgba(37,99,235,0.5)] active:scale-95 transition-all
          animate-pulse"
        style={{ animationDuration: '3s' }}
      >
        <HelpCircle size={20} />
        ¿NECESITÁS AYUDA?
      </button>

      {/* Modal de ayuda */}
      {open && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 bg-blue-600 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <HelpCircle size={24} className="text-white" />
                <h2 className="font-black text-white text-lg">{titulo}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-blue-700 rounded-xl text-white">
                <X size={22} />
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {items.map((item, i) => {
                const color =
                  item.tipo === 'ok'   ? 'bg-green-50 border-green-300' :
                  item.tipo === 'no'   ? 'bg-red-50 border-red-300' :
                                          'bg-blue-50 border-blue-200';
                const emoji =
                  item.tipo === 'ok'   ? '✅' :
                  item.tipo === 'no'   ? '⛔' :
                                          '💡';
                return (
                  <div key={i} className={`border-2 ${color} rounded-2xl p-4`}>
                    <p className="font-black text-slate-800 text-base mb-1.5 flex items-start gap-2">
                      <span className="shrink-0">{emoji}</span>
                      <span>{item.pregunta}</span>
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed pl-7">{item.respuesta}</p>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all active:scale-95"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}