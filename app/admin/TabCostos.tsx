"use client";
import React, { useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import HopeSwitch from './HopeSwitch';
import { useDatosCostos } from './costos/shared';
import CostosProductos from './costos/CostosProductos';
import CostosPrecios from './costos/CostosPrecios';
import CostosReceta from './costos/CostosReceta';

// ─────────────────────────────────────────────────────────────────────────────
// Costos: por producto (recetas de Fudo), precios de insumos y calculador por receta.
// Todo se calcula acá; no se escribe nada en Fudo.
// Precios en la tabla `costos_insumos` (sql/20261104_costos_insumos.sql).
// ─────────────────────────────────────────────────────────────────────────────

type Vista = 'costos' | 'precios' | 'receta';

export default function TabCostos() {
  const datos = useDatosCostos();
  const [vista, setVista] = useState<Vista>('receta');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center"><Calculator size={22} /></div>
          <div>
            <h2 className="text-xl font-black text-white">Costos</h2>
            <p className="text-xs text-slate-400">Cuánto cuesta hacer cada producto, según su receta y los precios de los insumos.</p>
          </div>
        </div>
        <HopeSwitch fit name="costos-vista"
          options={[
            { id: 'receta',  label: '🧮 Recetas' },
            { id: 'costos',  label: '🍔 Costos' },
            { id: 'precios', label: '💲 Precios de insumos' },
          ]}
          value={vista} onChange={setVista} />
      </div>

      {datos.modo === 'local' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300">
            Los precios se guardan <strong>solo en este navegador</strong>. Para guardarlos para todos, corré el SQL
            <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-amber-200 text-xs">sql/20261104_costos_insumos.sql</code>
            en Supabase.
          </p>
        </div>
      )}

      {vista === 'costos'  && <CostosProductos datos={datos} irAPrecios={() => setVista('precios')} />}
      {vista === 'precios' && <CostosPrecios datos={datos} />}
      {vista === 'receta'  && <CostosReceta datos={datos} />}
    </div>
  );
}
