"use client";

import React, { useState } from 'react';
import { Users, BarChart2 } from 'lucide-react';
import TabUsuarios from './TabUsuarios';
import TabOperadores from './TabOperadores';

type Sub = 'operadores' | 'rendimiento';

export default function TabEquipo() {
  const [sub, setSub] = useState<Sub>('operadores');

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700 p-1 rounded-xl w-fit">
        <button
          onClick={() => setSub('operadores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all
            ${sub === 'operadores' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
          <Users size={15} /> Operadores
        </button>
        <button
          onClick={() => setSub('rendimiento')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all
            ${sub === 'rendimiento' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
          <BarChart2 size={15} /> Rendimiento
        </button>
      </div>

      {sub === 'operadores'  && <TabUsuarios />}
      {sub === 'rendimiento' && <TabOperadores />}
    </div>
  );
}
