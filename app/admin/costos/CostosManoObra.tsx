"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { parseNumero } from '../../components/stockNames';
import { formatPlata, formatNumero } from '../format';
import { hoyISO, type DatosCostos, type EntradaMO } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Mano de obra por medallón: se carga por día, queda fija hasta que se cargue otra
// y se puede corregir. Cada medallón de las hamburguesas suma este valor al costo.
// ─────────────────────────────────────────────────────────────────────────────

const fechaLinda = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
const solo = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/[^0-9.,]/g, ''));
const redondear = (n: number) => Math.round(n * 100) / 100;

function Variacion({ delta, base }: { delta: number; base: number }) {
  if (!base || Math.abs(delta) < 0.005) return <span className="text-slate-500 inline-flex items-center gap-1"><Minus size={13} />igual</span>;
  const pct = (delta / base) * 100;
  const sube = delta > 0;   // para un costo, subir es "malo"
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${sube ? 'text-red-400' : 'text-green-400'}`}>
      {sube ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {sube ? '+' : '−'}{formatPlata(Math.abs(delta))} ({sube ? '+' : '−'}{formatNumero(Math.abs(pct), 1)}%)
    </span>
  );
}

/** Gráfico en escalones: el valor queda fijo hasta que se carga otro. */
function Grafico({ datos }: { datos: EntradaMO[] }) {
  if (datos.length < 2) return <p className="text-sm text-slate-500 py-6 text-center">Cuando cargues un segundo valor, acá vas a ver cómo cambió.</p>;
  const W = 640, H = 170, PL = 44, PR = 44, PT = 22, PB = 26;
  const t = (iso: string) => new Date(iso + 'T12:00:00').getTime();
  const t0 = t(datos[0].fecha), t1 = Math.max(t(datos[datos.length - 1].fecha), t0 + 86400000);
  const vals = datos.map(d => d.por_medallon);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.2 || hi * 0.1 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const x = (iso: string) => PL + ((t(iso) - t0) / (t1 - t0)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);
  let path = `M ${x(datos[0].fecha)} ${y(datos[0].por_medallon)}`;
  for (let i = 1; i < datos.length; i++) path += ` L ${x(datos[i].fecha)} ${y(datos[i - 1].por_medallon)} L ${x(datos[i].fecha)} ${y(datos[i].por_medallon)}`;
  const ult = datos[datos.length - 1];
  path += ` L ${W - PR} ${y(ult.por_medallon)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolución de la mano de obra por medallón">
      <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="currentColor" className="text-slate-700" />
      <path d={path} fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinejoin="round" />
      {datos.map(d => (
        <g key={d.fecha}>
          <circle cx={x(d.fecha)} cy={y(d.por_medallon)} r={4} fill="#60a5fa" />
          <text x={x(d.fecha)} y={y(d.por_medallon) - 9} textAnchor="middle" className="fill-white" fontSize={11} fontWeight={700}>{formatPlata(d.por_medallon)}</text>
          <text x={x(d.fecha)} y={H - 8} textAnchor="middle" className="fill-slate-500" fontSize={10}>{fechaLinda(d.fecha)}</text>
        </g>
      ))}
    </svg>
  );
}

export default function CostosManoObra({ datos }: { datos: DatosCostos }) {
  const { historial, guardar, borrar, vigenteEntrada, vigente } = datos.manoObra;
  const [fecha, setFecha] = useState(hoyISO());
  const [fechaVieja, setFechaVieja] = useState<string | undefined>();
  const [jornada, setJornada] = useState('');
  const [medallones, setMedallones] = useState('');
  const [valor, setValor] = useState('');
  const [nota, setNota] = useState('');
  const [aviso, setAviso] = useState('');

  const j = parseNumero(jornada), m = parseNumero(medallones);
  // con la jornada y los medallones, el valor por medallón se calcula solo (se puede pisar a mano)
  useEffect(() => { if (j > 0 && m > 0) setValor(String(redondear(j / m)).replace('.', ',')); }, [j, m]);

  const v = parseNumero(valor);
  const valido = v > 0 && !!fecha;
  const anterior = useMemo(() => [...historial].reverse().find(h => h.fecha < fecha), [historial, fecha]);

  const limpiar = () => { setFecha(hoyISO()); setFechaVieja(undefined); setJornada(''); setMedallones(''); setValor(''); setNota(''); };
  const enviar = async () => {
    if (!valido) return;
    await guardar({ fecha, jornada: j > 0 ? j : null, medallones: m > 0 ? m : null, por_medallon: redondear(v), nota: nota.trim() }, fechaVieja);
    setAviso(`Guardado: ${formatPlata(redondear(v))} por medallón desde el ${fechaLinda(fecha)}.`);
    limpiar();
  };
  const editar = (e: EntradaMO) => {
    setFecha(e.fecha); setFechaVieja(e.fecha); setJornada(e.jornada ? String(e.jornada).replace('.', ',') : '');
    setMedallones(e.medallones ? String(e.medallones).replace('.', ',') : ''); setValor(String(e.por_medallon).replace('.', ',')); setNota(e.nota); setAviso('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filas = [...historial].reverse();
  const prevDe = (i: number) => filas[i + 1];
  const penultima = historial.length > 1 ? historial[historial.length - 2] : undefined;
  const campo = 'w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500';
  const rotulo = 'text-[10px] text-slate-500 uppercase font-bold mb-1 block';

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="hp-glass p-4">
          <p className="text-[10px] text-slate-500 uppercase font-bold">Mano de obra vigente</p>
          <p className="text-3xl font-black text-white mt-1">{formatPlata(vigente)}</p>
          <p className="text-xs text-slate-400 mt-1">por medallón · desde el {vigenteEntrada ? fechaLinda(vigenteEntrada.fecha) : '—'}</p>
        </div>
        <div className="hp-glass p-4">
          <p className="text-[10px] text-slate-500 uppercase font-bold">Cambio vs. la carga anterior</p>
          <p className="text-sm mt-2">{penultima ? <Variacion delta={historial[historial.length - 1].por_medallon - penultima.por_medallon} base={penultima.por_medallon} /> : <span className="text-slate-500">Todavía no hay una carga anterior</span>}</p>
        </div>
        <div className="hp-glass p-4">
          <p className="text-[10px] text-slate-500 uppercase font-bold">Lo que suma a cada hamburguesa</p>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Simple <strong className="text-white">{formatPlata(vigente)}</strong> · Doble <strong className="text-white">{formatPlata(vigente * 2)}</strong> · Triple <strong className="text-white">{formatPlata(vigente * 3)}</strong>
          </p>
        </div>
      </div>

      {/* Cargar / cambiar */}
      <div className="hp-glass p-5 space-y-4">
        <div>
          <h3 className="font-black text-white">{fechaVieja ? `Corregir la carga del ${fechaLinda(fechaVieja)}` : 'Cargar o cambiar la mano de obra'}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            El valor queda fijo en todos los costos hasta que cargues uno nuevo. Podés poner lo que se pagó y cuántos medallones se hicieron (el sistema calcula el valor), o escribir el valor directo.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block"><span className={rotulo}>Desde el día</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={campo} />
            <span className="text-[11px] text-slate-500 mt-1 block">Si ya hay una carga ese día, se reemplaza.</span></label>
          <label className="block"><span className={rotulo}>Pago de la jornada ($, opcional)</span>
            <input type="text" inputMode="decimal" value={jornada} onChange={solo(setJornada)} placeholder="45000" className={campo} />
            <span className="text-[11px] text-slate-500 mt-1 block">Lo que se pagó por la media jornada.</span></label>
          <label className="block"><span className={rotulo}>Medallones hechos (opcional)</span>
            <input type="text" inputMode="decimal" value={medallones} onChange={solo(setMedallones)} placeholder="200" className={campo} />
            <span className="text-[11px] text-slate-500 mt-1 block">Cuántos medallones salieron en esa jornada.</span></label>
          <label className="block"><span className={rotulo}>$ por medallón</span>
            <input type="text" inputMode="decimal" value={valor} onChange={solo(setValor)} placeholder="400" className={`${campo} text-lg`} />
            <span className="text-[11px] text-slate-500 mt-1 block">Se calcula solo si cargás los dos de al lado.</span></label>
        </div>
        <label className="block"><span className={rotulo}>Nota (opcional)</span>
          <input type="text" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: subió la jornada" className={campo} /></label>
        {valido && anterior && (
          <p className="text-sm text-slate-300 flex items-center gap-2 flex-wrap">Respecto de {formatPlata(anterior.por_medallon)} ({fechaLinda(anterior.fecha)}): <Variacion delta={v - anterior.por_medallon} base={anterior.por_medallon} /></p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={enviar} disabled={!valido}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
            {fechaVieja ? 'Guardar corrección' : 'Guardar'}
          </button>
          {(fechaVieja || jornada || medallones || valor || nota) && (
            <button type="button" onClick={limpiar} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">Cancelar</button>
          )}
          {aviso && <span className="text-sm text-green-400 font-bold">{aviso}</span>}
        </div>
      </div>

      {/* Dashboard de cambios */}
      <div className="hp-glass p-5">
        <h3 className="font-black text-white mb-2">Cómo fue cambiando</h3>
        <Grafico datos={historial} />
      </div>

      <div className="hp-glass p-5">
        <h3 className="font-black text-white mb-3">Historial de cargas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-slate-500 uppercase font-bold">
                <th className="py-2 pr-3">Desde</th><th className="py-2 pr-3 text-right">$ por medallón</th><th className="py-2 pr-3">Cambio</th>
                <th className="py-2 pr-3 text-right">Jornada</th><th className="py-2 pr-3 text-right">Medallones</th><th className="py-2 pr-3">Nota</th><th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => {
                const p = prevDe(i);
                const esVigente = vigenteEntrada?.fecha === f.fecha;
                return (
                  <tr key={f.fecha} className="border-t border-slate-800">
                    <td className="py-2.5 pr-3 text-white font-bold whitespace-nowrap">{fechaLinda(f.fecha)}{esVigente && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-black uppercase">vigente</span>}</td>
                    <td className="py-2.5 pr-3 text-right text-white font-black">{formatPlata(f.por_medallon)}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{p ? <Variacion delta={f.por_medallon - p.por_medallon} base={p.por_medallon} /> : <span className="text-slate-500">primera carga</span>}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-300">{f.jornada ? formatPlata(f.jornada) : '—'}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-300">{f.medallones ? formatNumero(f.medallones, 0) : '—'}</td>
                    <td className="py-2.5 pr-3 text-slate-400">{f.nota || '—'}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button type="button" onClick={() => editar(f)} title="Corregir esta carga" className="p-1.5 text-slate-400 hover:text-white"><Pencil size={15} /></button>
                      {historial.length > 1 && (
                        <button type="button" onClick={() => { if (window.confirm(`¿Borrar la carga del ${fechaLinda(f.fecha)}?`)) borrar(f.fecha); }}
                          title="Borrar esta carga" className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 size={15} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
