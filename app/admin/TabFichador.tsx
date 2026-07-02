"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, Download, AlertTriangle, CheckCircle2, Loader2, X, History, ExternalLink } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Reporte = {
  id: number;
  filename: string;
  url: string;
  rows_count: number;
  empleados_count: number;
  created_at: string;
};

type FileState = { file: File; name: string } | null;

function Dropzone({
  label, accept, ext, value, onChange,
}: {
  label: string; accept: string; ext: string;
  value: FileState; onChange: (f: FileState) => void;
}) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) onChange({ file, name: file.name });
  }, [onChange]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onChange({ file, name: file.name });
    e.target.value = '';
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !value && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all
        ${value
          ? 'border-green-500/50 bg-green-500/5 cursor-default'
          : drag
          ? 'border-blue-400 bg-blue-500/10 cursor-copy'
          : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 cursor-pointer'
        }`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />

      {value ? (
        <>
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <FileText size={20} className="text-green-400" />
          </div>
          <div className="text-center">
            <p className="text-green-400 font-black text-sm">{value.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{(value.file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onChange(null); }}
            className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <Upload size={20} className="text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm">{label}</p>
            <p className="text-slate-500 text-xs mt-0.5">
              Arrastrá o hacé click · <span className="font-mono text-slate-400">{ext}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function TabFichador() {
  const [yg5, setYg5]           = useState<FileState>(null);
  const [kq,  setKq]            = useState<FileState>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  const canGenerate = yg5 && kq && !loading;

  const loadReportes = async () => {
    setLoadingHist(true);
    const { data } = await supabase
      .from('fichador_reportes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setReportes((data ?? []) as Reporte[]);
    setLoadingHist(false);
  };

  useEffect(() => { loadReportes(); }, []);

  const handleGenerar = async () => {
    if (!canGenerate) return;
    setLoading(true); setError(''); setSuccess('');

    try {
      const form = new FormData();
      form.append('yg5', yg5.file);
      form.append('kq',  kq.file);

      const res = await fetch('/api/anviz', { method: 'POST', body: form });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      // Descargar el xlsx
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const fecha = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `Asistencia_${fecha}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      setSuccess(`Excel generado y descargado correctamente.`);
      loadReportes(); // refrescar historial
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="font-black text-xl text-white">Fichador Anviz</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Procesá los archivos del reloj biométrico y descargá el reporte de horas en Excel
        </p>
      </div>

      {/* Explicación */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-1 leading-relaxed">
        <p><span className="text-slate-200 font-bold font-mono">BAK.YG5</span> — Mapeo de IDs y nombres del reloj</p>
        <p><span className="text-slate-200 font-bold font-mono">BAK.KQ</span> — Registros de fichadas (entradas y salidas)</p>
        <p className="text-slate-600 pt-1">
          Los turnos nocturnos se agrupan restando 6 horas lógicas — las salidas de madrugada quedan en el turno correcto.
        </p>
      </div>

      {/* Dropzones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Dropzone
          label="Archivo de usuarios"
          accept=".YG5,.yg5,*"
          ext="BAK.YG5"
          value={yg5}
          onChange={setYg5}
        />
        <Dropzone
          label="Archivo de fichadas"
          accept=".KQ,.kq,*"
          ext="BAK.KQ"
          value={kq}
          onChange={setKq}
        />
      </div>

      {/* Error / Success */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={17} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm font-bold">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex gap-3">
          <CheckCircle2 size={17} className="text-green-400 shrink-0" />
          <p className="text-green-400 text-sm font-bold">{success}</p>
        </div>
      )}

      {/* Botón */}
      <button
        onClick={handleGenerar}
        disabled={!canGenerate}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black text-base rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
      >
        {loading
          ? <><Loader2 size={20} className="animate-spin" /> Procesando...</>
          : <><Download size={20} /> Generar Excel</>
        }
      </button>

      {/* Info */}
      <div className="text-xs text-slate-600 text-center">
        El archivo se descarga directamente. También queda guardado en el historial de abajo.
      </div>

      {/* Historial */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={15} className="text-slate-400" />
            <p className="font-black text-xs text-slate-400 uppercase">Reportes anteriores</p>
          </div>
          {reportes.length > 0 && (
            <span className="text-xs text-slate-600">{reportes.length} archivos</span>
          )}
        </div>

        {loadingHist && (
          <div className="px-5 py-6 text-center">
            <Loader2 size={16} className="text-slate-600 animate-spin mx-auto" />
          </div>
        )}

        {!loadingHist && reportes.length === 0 && (
          <div className="px-5 py-6 text-center">
            <p className="text-slate-600 text-sm">Sin reportes aún. Generá el primero arriba.</p>
          </div>
        )}

        {!loadingHist && reportes.length > 0 && (
          <div className="divide-y divide-slate-800/60">
            {reportes.map(r => {
              const fecha = new Date(r.created_at);
              const fechaStr = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const horaStr  = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                      <FileText size={15} className="text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{fechaStr} · {horaStr}</p>
                      <p className="text-xs text-slate-500">
                        {r.empleados_count} empleado{r.empleados_count !== 1 ? 's' : ''}
                        {' · '}{r.rows_count} turno{r.rows_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <a
                    href={r.url}
                    download={r.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors shrink-0"
                  >
                    <Download size={13} />
                    Descargar
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
