"use client";

import React, { useState } from 'react';
import { Users, Award } from 'lucide-react';
import TabUsuarios from './TabUsuarios';
import TabOperadores from './TabOperadores';

type Sub = 'usuarios' | 'rendimiento';

export default function TabEquipo() {
  const [sub, setSub] = useState<Sub>('usuarios');

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700 p-1 rounded-xl w-fit">
        <button
          onClick={() => setSub('usuarios')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all
            ${sub === 'usuarios'
              ? 'bg-white text-slate-900'
              : 'text-slate-400 hover:text-white'}`}>
          <Users size={15} /> Usuarios
        </button>
        <button
          onClick={() => setSub('rendimiento')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all
            ${sub === 'rendimiento'
              ? 'bg-white text-slate-900'
              : 'text-slate-400 hover:text-white'}`}>
          <Award size={15} /> Rendimiento
        </button>
      </div>

      {sub === 'usuarios'    && <TabUsuarios />}
      {sub === 'rendimiento' && <TabOperadores />}
    </div>
  );
}
