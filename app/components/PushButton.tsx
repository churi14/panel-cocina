"use client";

import React, { useState } from 'react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import { usePushNotifications } from './usePushNotifications';

export default function PushButton() {
  const { status, subscribe, unsubscribe } = usePushNotifications();
  const [showMenu, setShowMenu] = useState(false);

  if (status === 'unsupported') return null;
  if (status === 'loading') return <div className="w-9 h-9 rounded-xl bg-slate-800 animate-pulse" />;

  // Bloqueado por el usuario
  if (status === 'denied') return (
    <div title="Notificaciones bloqueadas en el navegador"
      className="p-2 rounded-xl bg-slate-800/50 text-slate-600 cursor-not-allowed">
      <BellOff size={18} />
    </div>
  );

  // Ya suscripto — campanita verde con opción de desactivar
  if (status === 'granted') return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        className="relative p-2 hover:bg-slate-800 rounded-xl transition-colors text-green-400"
        title="Notificaciones activas">
        <BellRing size={18} />
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-slate-900" />
      </button>
      {showMenu && (
        <div className="absolute right-0 top-10 bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-xl z-50 w-52">
          <p className="text-xs text-slate-400 font-bold uppercase mb-2">Notificaciones</p>
          <p className="text-xs text-green-400 mb-3">✓ Activas en este dispositivo</p>
          <button
            onClick={() => { unsubscribe(); setShowMenu(false); }}
            className="w-full text-xs text-red-400 hover:text-red-300 hover:bg-slate-700 py-2 px-3 rounded-lg transition-colors text-left">
            Desactivar notificaciones
          </button>
        </div>
      )}
    </div>
  );

  // No suscripto — botón claro para activar
  return (
    <button
      onClick={subscribe}
      className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl transition-colors text-amber-400 text-xs font-bold"
      title="Activar notificaciones">
      <Bell size={15} />
      <span className="hidden sm:inline">Activar alertas</span>
    </button>
  );
}