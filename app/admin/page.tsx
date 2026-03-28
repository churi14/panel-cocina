"use client";

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import AdminDashboard from './AdminDashboard';

const ADMIN_PIN = '0000'; // ← Cambiar acá

function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      if (next === ADMIN_PIN) {
        setTimeout(onUnlock, 200);
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => { setPin(''); setShake(false); }, 600);
      }
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-1">KitchenOS Admin</h1>
        <p className="text-slate-400 text-sm mb-8">Ingresá tu PIN para continuar</p>

        {/* Puntos */}
        <div className={`flex justify-center gap-4 mb-8 ${shake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-150
              ${i < pin.length
                ? error ? 'bg-red-500' : 'bg-slate-900'
                : 'bg-slate-200'}`} />
          ))}
        </div>

        {/* Teclado */}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button key={i}
              onClick={() => d === '⌫' ? handleDelete() : d ? handleDigit(d) : null}
              disabled={!d && d !== '0'}
              className={`h-14 rounded-2xl text-xl font-bold transition-all active:scale-95
                ${d === '⌫' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' :
                  d === '' ? '' :
                  'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200'}`}>
              {d}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm font-bold mt-4">PIN incorrecto</p>}
      </div>
    </div>
  );
}


export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  return unlocked
    ? <AdminDashboard onLock={() => setUnlocked(false)} />
    : <PinScreen onUnlock={() => setUnlocked(true)} />;
}