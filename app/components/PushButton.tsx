"use client";

import React from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from './usePushNotifications';

export default function PushButton() {
  const { status, subscribe, unsubscribe, sendTest } = usePushNotifications();

  if (status === 'unsupported') return null;

  if (status === 'loading') return (
    <div className="w-9 h-9 rounded-xl bg-slate-800 animate-pulse" />
  );

  if (status === 'denied') return (
    <div title="Notificaciones bloqueadas — habilitá en la config del navegador"
      className="p-2 rounded-xl bg-slate-800 text-slate-600 cursor-not-allowed">
      <BellOff size={18} />
    </div>
  );

  if (status === 'granted') return (
    <div className="flex items-center gap-2">
      <button onClick={sendTest} title="Enviar notificación de prueba"
        className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-green-400">
        <BellRing size={18} />
      </button>
      <button onClick={unsubscribe} title="Desactivar notificaciones"
        className="text-xs text-slate-500 hover:text-red-400 transition-colors">
        off
      </button>
    </div>
  );

  // default — no suscripto todavía
  return (
    <button onClick={subscribe} title="Activar notificaciones push"
      className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-amber-400">
      <Bell size={18} />
    </button>
  );
}