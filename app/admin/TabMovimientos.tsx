"use client";
import React, { useState } from 'react';
import { Filter, X, Check, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase';
import { Movement, formatFecha } from './types';

type Props = {
  movements: Movement[];
  filterType: 'all' | 'ingreso' | 'egreso';
  setFilterType: React.Dispatch<React.SetStateAction<'all' | 'ingreso' | 'egreso'>>;
  filterOp: string;
  setFilterOp: React.Dispatch<React.SetStateAction<string>>;
  fetchMovements: () => Promise<void>;
};

export default function TabMovimientos({ movements, filterType, setFilterType, filterOp, setFilterOp, fetchMovements }: Props) {
  const [editingM, setEditingM] = useState<Movement | null>(null);
  const [editCantidad, setEditCantidad] = useState('');
  const [editMotivo, setEditMotivo] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Movement | null>(null);

  const filtered = movements.filter(m => {
    if (filterType !== 'all' && m.tipo !== filterType) return false;
    if (filterOp !== 'all' && m.operador !== filterOp) return false;
    return true;
  });
  const operadores = [...new Set(movements.map(m => m.operador).filter(Boolean))];

  const openEdit = (m: Movement) => {
    setEditingM(m);
    setEditCantidad(String(m.cantidad));
    setEditMotivo(m.motivo ?? '');
    setEditNombre(m.nombre ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editingM) return;
    setSaving(true);
    const newQty = parseFloat(editCantidad.replace(',', '.'));
    const diff = newQty - editingM.cantidad;

    // Update the movement record
    await supabase.from('stock_movements').update({
      cantidad: newQty,
      nombre: editNombre.trim(),
      motivo: editMotivo.trim() + ' [editado desde admin]',
    }).eq('id', editingM.id);

    // If quantity changed, also fix the stock
    if (diff !== 0) {
      const tabla = editingM.categoria === 'produccion' ? 'stock_produccion' : 'stock';
      const campoNombre = tabla === 'stock_produccion' ? 'producto' : 'nombre';
      const { data } = await supabase.from(tabla).select('id, cantidad')
        .ilike(campoNombre, editNombre.trim()).maybeSingle();
      if (data) {
        const tipo = editingM.tipo;
        // ingreso: sumó al stock → si subimos qty sumamos más, si bajamos quitamos
        // egreso: restó del stock → si subimos qty quitamos más, si bajamos devolvemos
        const stockDiff = tipo === 'ingreso' ? diff : -diff;
        await supabase.from(tabla).update({
          cantidad: parseFloat((Number(data.cantidad) + stockDiff).toFixed(3)),
          ...(tabla === 'stock' ? { fecha_actualizacion: new Date().toISOString().slice(0, 10) } : { ultima_prod: new Date().toISOString() }),
        }).eq('id', data.id);
      }
    }

    setSaving(false);
    setEditingM(null);
    await fetchMovements();
  };

  const handleDelete = async (m: Movement) => {
    setSaving(true);
    // Revertir el efecto en stock antes de borrar
    const tabla = m.categoria === 'produccion' ? 'stock_produccion' : 'stock';
    const campoNombre = tabla === 'stock_produccion' ? 'producto' : 'nombre';
    const { data } = await supabase.from(tabla).select('id, cantidad')
      .ilike(campoNombre, m.nombre ?? '').maybeSingle();
    if (data) {
      const revert = m.tipo === 'ingreso' ? -m.cantidad : m.cantidad;
      await supabase.from(tabla).update({
        cantidad: parseFloat((Number(data.cantidad) + revert).toFixed(3)),
        ...(tabla === 'stock' ? { fecha_actualizacion: new Date().toISOString().slice(0, 10) } : {}),
      }).eq('id', data.id);
    }
    await supabase.from('stock_movements').delete().eq('id', m.id);
    setSaving(false);
    setDeleteConfirm(null);
    await fetchMovements();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap gap-4 items-center">
        <div className="flex bg-slate-800 p-1 rounded-xl gap-1">
          {(['all', 'ingreso', 'egreso'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${filterType === t ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
              {t === 'all' ? 'Todos' : t === 'ingreso' ? '↑ Ingresos' : '↓ Egresos'}
            </button>
          ))}
        </div>
        <select value={filterOp} onChange={e => setFilterOp(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-sm text-slate-300 rounded-xl px-3 py-2 outline-none">
          <option value="all">Todos los operadores</option>
          {operadores.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
        <span className="text-slate-600 text-xs ml-auto">{filtered.length} registros</span>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Operador</th>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-center">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{formatFecha(m.fecha)}</td>
                  <td className="px-4 py-3 font-bold text-slate-300 text-xs">{m.operador ?? '—'}</td>
                  <td className="px-4 py-3 font-bold text-white text-xs">{m.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black
                      ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {m.tipo === 'ingreso' ? '↑ INGRESO' : '↓ EGRESO'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-[160px] truncate">{m.motivo ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-black text-white">
                    {m.unidad === 'kg' || m.unidad === 'lt'
                      ? m.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                      : m.cantidad} {m.unidad}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(m)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-400 transition-colors text-xs font-bold"
                        title="Editar">✏️</button>
                      <button onClick={() => setDeleteConfirm(m)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
                        title="Eliminar y revertir stock">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-600">No hay movimientos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditingM(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white">✏️ Editar movimiento</h3>
              <button onClick={() => setEditingM(null)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-400 space-y-1">
              <p>Fecha: <span className="text-white">{formatFecha(editingM.fecha)}</span></p>
              <p>Operador: <span className="text-white">{editingM.operador}</span></p>
              <p>Tipo: <span className={editingM.tipo === 'ingreso' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{editingM.tipo}</span></p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">Editar la cantidad también ajusta el stock del producto automáticamente.</p>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Producto</label>
              <input value={editNombre} onChange={e => setEditNombre(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase mb-1 block">
                Cantidad ({editingM.unidad}) — original: {editingM.cantidad}
              </label>
              <input type="number" value={editCantidad} onChange={e => setEditCantidad(e.target.value)}
                step="0.001"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Motivo / Aclaración</label>
              <input value={editMotivo} onChange={e => setEditMotivo(e.target.value)}
                placeholder="Ej: Error de carga, era aceite no esponja"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>

            <button onClick={handleSaveEdit} disabled={saving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : <><Check size={14} /> Guardar cambios</>}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDeleteConfirm(null)}>
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Trash2 size={22} className="text-red-400" />
              </div>
              <h3 className="font-black text-white">¿Eliminar movimiento?</h3>
              <p className="text-slate-400 text-sm mt-1">
                Se borrará <span className="font-black text-white">{deleteConfirm.nombre}</span> {deleteConfirm.cantidad} {deleteConfirm.unidad} y se revertirá el efecto en el stock.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-slate-700 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-800">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={saving}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><RefreshCw size={13} className="animate-spin" /> Eliminando...</> : 'Eliminar y revertir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}