"use client";
import React, { useState, useEffect } from 'react';
import { X, Snowflake, ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase';
import { useOperadores } from '../hooks/useOperadores';

const CATEGORIAS = [
  { id: 'carne',      label: 'Carne',       emoji: '🥩', unidad: 'kg',  color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200' },
  { id: 'pan_kalis',  label: 'Pan Kalis',   emoji: '🍞', unidad: 'u',   color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'medallones', label: 'Medallones',  emoji: '🍔', unidad: 'u',   color: 'text-orange-600',bg: 'bg-orange-50',border: 'border-orange-200' },
];

type Item = {
  id: string;
  producto: string;
  categoria: string;
  cantidad: number;
  unidad: string;
  estado: 'en_camara' | 'retirado';
  fecha_ingreso: string;
  fecha_retiro: string | null;
  disponible_desde: string | null;
  operador: string;
  observacion: string | null;
};

function tiempoRestante(disponibleDesde: string): { horas: number; minutos: number; listo: boolean } {
  const diff = new Date(disponibleDesde).getTime() - Date.now();
  if (diff <= 0) return { horas: 0, minutos: 0, listo: true };
  const horas   = Math.floor(diff / 3600000);
  const minutos = Math.floor((diff % 3600000) / 60000);
  return { horas, minutos, listo: false };
}

export default function CamaraFrioModal({ onClose, operadorNombre }: { onClose: () => void; operadorNombre: string }) {
  const operadores = useOperadores();
  const [view, setView]         = useState<'stock' | 'ingresar' | 'retirar'>('stock');
  const [items, setItems]       = useState<Item[]>([]);
  const [loading, setLoading]   = useState(true);
  const [operador, setOperador] = useState(operadorNombre || '');

  // Ingresar
  const [ingCategoria, setIngCategoria] = useState('carne');
  const [ingProducto, setIngProducto]   = useState('');
  const [ingCantidad, setIngCantidad]   = useState('');
  const [ingObs, setIngObs]             = useState('');
  const [saving, setSaving]             = useState(false);

  // Retirar
  const [retirando, setRetirando]       = useState<Item | null>(null);
  const [retCantidad, setRetCantidad]   = useState('');

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('camara_frio')
      .select('*')
      .order('fecha_ingreso', { ascending: false });
    setItems((data ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  // Tick para actualizar contadores
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const enCamara  = items.filter(i => i.estado === 'en_camara');
  const retirados = items.filter(i => i.estado === 'retirado').slice(0, 20);

  const handleIngresar = async () => {
    const cant = parseFloat(ingCantidad.replace(',', '.'));
    if (!cant || !ingProducto.trim()) return;
    setSaving(true);
    const cat = CATEGORIAS.find(c => c.id === ingCategoria);
    await supabase.from('camara_frio').insert({
      producto: ingProducto.trim(),
      categoria: ingCategoria,
      cantidad: cant,
      unidad: cat?.unidad ?? 'kg',
      estado: 'en_camara',
      operador,
      observacion: ingObs.trim() || null,
    });
    setIngProducto(''); setIngCantidad(''); setIngObs('');
    await fetchItems();
    setSaving(false);
    setView('stock');
  };

  const handleRetirar = async () => {
    if (!retirando) return;
    const cant = parseFloat(retCantidad.replace(',', '.'));
    if (!cant || cant > retirando.cantidad) return;
    setSaving(true);
    const disponibleDesde = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    if (cant < retirando.cantidad) {
      // Retiro parcial — actualizar el existente y crear registro de retiro
      await supabase.from('camara_frio').update({
        cantidad: parseFloat((retirando.cantidad - cant).toFixed(3)),
      }).eq('id', retirando.id);
      // Crear nuevo registro para lo retirado
      await supabase.from('camara_frio').insert({
        producto: retirando.producto,
        categoria: retirando.categoria,
        cantidad: cant,
        unidad: retirando.unidad,
        estado: 'retirado',
        fecha_retiro: new Date().toISOString(),
        disponible_desde: disponibleDesde,
        operador,
      });
    } else {
      // Retiro total
      await supabase.from('camara_frio').update({
        estado: 'retirado',
        fecha_retiro: new Date().toISOString(),
        disponible_desde: disponibleDesde,
      }).eq('id', retirando.id);
    }

    setRetirando(null); setRetCantidad('');
    await fetchItems();
    setSaving(false);
  };

  const catCfg = (cat: string) => CATEGORIAS.find(c => c.id === cat) ?? CATEGORIAS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="px-6 py-5 bg-blue-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Snowflake size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-white text-lg">Cámara de Frío</h2>
              <p className="text-blue-200 text-xs">{enCamara.length} items en cámara</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl text-white transition-all">
            <X size={22} />
          </button>
        </div>

        {/* OPERADOR */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 shrink-0">
          <span className="text-xs font-black text-slate-500 uppercase">Quién:</span>
          <div className="flex gap-2 flex-wrap">
            {operadores.map(op => (
              <button key={op} onClick={() => setOperador(op)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all
                  ${operador === op ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                {op}
              </button>
            ))}
          </div>
        </div>

        {/* SUB-NAV */}
        <div className="flex border-b border-slate-100 shrink-0">
          {[
            { id: 'stock',    label: '❄️ En cámara' },
            { id: 'ingresar', label: '↓ Ingresar' },
            { id: 'retirar',  label: '↑ Retirar' },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id as any)}
              className={`flex-1 py-3 text-sm font-black transition-all
                ${view === t.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── STOCK EN CÁMARA ── */}
          {view === 'stock' && (
            <div className="space-y-3">
              {loading && <p className="text-center text-slate-400 py-8">Cargando...</p>}
              {!loading && enCamara.length === 0 && (
                <div className="text-center py-12">
                  <Snowflake size={40} className="text-slate-300 mx-auto mb-3" />
                  <p className="font-bold text-slate-400">La cámara está vacía</p>
                  <p className="text-xs text-slate-400 mt-1">Usá "Ingresar" para agregar stock</p>
                </div>
              )}
              {enCamara.map(item => {
                const cfg = catCfg(item.categoria);
                return (
                  <div key={item.id} className={`border-2 ${cfg.border} ${cfg.bg} rounded-2xl p-4`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cfg.emoji}</span>
                        <div>
                          <p className="font-black text-slate-800">{item.producto}</p>
                          <p className="text-xs text-slate-500">{cfg.label} · Ingresó: {new Date(item.fecha_ingreso).toLocaleDateString('es-AR')} {new Date(item.fecha_ingreso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                          <p className="text-xs text-slate-500">Operador: {item.operador}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${cfg.color}`}>{item.cantidad} <span className="text-sm">{item.unidad}</span></p>
                        <button
                          onClick={() => { setRetirando(item); setRetCantidad(String(item.cantidad)); setView('retirar'); }}
                          className="mt-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-slate-700 transition-all flex items-center gap-1">
                          <ArrowUpFromLine size={12} /> Retirar
                        </button>
                      </div>
                    </div>
                    {item.observacion && (
                      <p className="text-xs text-slate-500 mt-2 italic">"{item.observacion}"</p>
                    )}
                  </div>
                );
              })}

              {/* Retirados recientes con countdown */}
              {retirados.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-black text-slate-400 uppercase mb-3">Retirados recientemente</p>
                  {retirados.map(item => {
                    const cfg = catCfg(item.categoria);
                    const timer = item.disponible_desde ? tiempoRestante(item.disponible_desde) : null;
                    return (
                      <div key={item.id} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between mb-2 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span>{cfg.emoji}</span>
                          <div>
                            <p className="font-bold text-slate-700 text-sm">{item.producto}</p>
                            <p className="text-xs text-slate-400">{item.cantidad} {item.unidad} · {item.operador}</p>
                          </div>
                        </div>
                        {timer && (
                          timer.listo
                            ? <span className="flex items-center gap-1 text-xs font-black text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                                <CheckCircle2 size={12} /> LISTO
                              </span>
                            : <span className="flex items-center gap-1 text-xs font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                                <Clock size={12} /> {timer.horas}h {timer.minutos}m
                              </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── INGRESAR ── */}
          {view === 'ingresar' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">Categoría</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIAS.map(cat => (
                    <button key={cat.id} onClick={() => setIngCategoria(cat.id)}
                      className={`py-3 rounded-xl border-2 font-black text-sm transition-all
                        ${ingCategoria === cat.id ? `${cat.bg} ${cat.border} ${cat.color}` : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">Producto / Descripción</label>
                <input type="text" value={ingProducto} onChange={e => setIngProducto(e.target.value)}
                  placeholder={ingCategoria === 'carne' ? 'Ej: Cuadril, Lomo, Vacío...' : ingCategoria === 'pan_kalis' ? 'Ej: Pan Kalis chico...' : 'Ej: Medallones Burger...'}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 transition-all" />
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">
                  Cantidad ({CATEGORIAS.find(c => c.id === ingCategoria)?.unidad})
                </label>
                <input type="number" inputMode="decimal" step="0.001" value={ingCantidad} onChange={e => setIngCantidad(e.target.value)}
                  placeholder="0"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-2xl font-black text-center outline-none focus:border-blue-400 transition-all" />
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">Observación (opcional)</label>
                <input type="text" value={ingObs} onChange={e => setIngObs(e.target.value)}
                  placeholder="Ej: de la compra del martes..."
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 transition-all" />
              </div>

              <button onClick={handleIngresar}
                disabled={saving || !ingProducto.trim() || !ingCantidad}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2">
                <ArrowDownToLine size={20} />
                {saving ? 'Guardando...' : 'Ingresar a Cámara'}
              </button>
            </div>
          )}

          {/* ── RETIRAR ── */}
          {view === 'retirar' && (
            <div className="space-y-5">
              {enCamara.length === 0 && !retirando && (
                <div className="text-center py-12">
                  <p className="font-bold text-slate-400">No hay nada en cámara para retirar</p>
                </div>
              )}
              {enCamara.length > 0 && !retirando && (
                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-500 uppercase mb-3">¿Qué vas a retirar?</p>
                  {enCamara.map(item => {
                    const cfg = catCfg(item.categoria);
                    return (
                      <button key={item.id}
                        onClick={() => { setRetirando(item); setRetCantidad(String(item.cantidad)); }}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 ${cfg.border} ${cfg.bg} hover:opacity-80 transition-all`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{cfg.emoji}</span>
                          <div className="text-left">
                            <p className="font-black text-slate-800">{item.producto}</p>
                            <p className="text-xs text-slate-500">{item.cantidad} {item.unidad} en cámara</p>
                          </div>
                        </div>
                        <ArrowUpFromLine size={18} className={cfg.color} />
                      </button>
                    );
                  })}
                </div>
              )}

              {retirando && (
                <div className="space-y-4">
                  <div className={`border-2 ${catCfg(retirando.categoria).border} ${catCfg(retirando.categoria).bg} rounded-2xl p-4`}>
                    <p className="font-black text-slate-800 text-lg">{catCfg(retirando.categoria).emoji} {retirando.producto}</p>
                    <p className="text-sm text-slate-500">Disponible en cámara: <span className="font-black text-slate-700">{retirando.cantidad} {retirando.unidad}</span></p>
                  </div>

                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-amber-700">Lo que retirés estará disponible para usar en <span className="font-black">24 horas</span> desde este momento.</p>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase mb-2 block">
                      ¿Cuánto retirás? (máx: {retirando.cantidad} {retirando.unidad})
                    </label>
                    <input type="number" inputMode="decimal" step="0.001"
                      value={retCantidad} onChange={e => setRetCantidad(e.target.value)}
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-2xl font-black text-center outline-none focus:border-blue-400 transition-all" />
                    {parseFloat(retCantidad) > retirando.cantidad && (
                      <p className="text-xs text-red-500 font-bold mt-1">⚠️ No podés retirar más de lo que hay en cámara</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { setRetirando(null); setRetCantidad(''); }}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition-all">
                      Cancelar
                    </button>
                    <button onClick={handleRetirar}
                      disabled={saving || !retCantidad || parseFloat(retCantidad) > retirando.cantidad || parseFloat(retCantidad) <= 0}
                      className="flex-1 py-3 bg-slate-900 hover:bg-slate-700 text-white font-black rounded-xl transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2">
                      <ArrowUpFromLine size={16} />
                      {saving ? 'Guardando...' : 'Confirmar retiro'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}