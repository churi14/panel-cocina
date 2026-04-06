"use client";

import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, RefreshCw, Bell, Store, TrendingUp, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

const NEGOCIOS = [
  { id: 'burger',   label: 'Burger Club',       emoji: '🍔', color: 'border-amber-500 bg-amber-500/10 text-amber-400' },
  { id: 'lomito',   label: 'Club del Lomito',    emoji: '🥩', color: 'border-rose-500 bg-rose-500/10 text-rose-400' },
  { id: 'milanesa', label: 'Milanesa',           emoji: '🫓', color: 'border-blue-500 bg-blue-500/10 text-blue-400' },
];

// Context de cada negocio para el prompt
const NEGOCIO_CONTEXT: Record<string, string> = {
  burger: `Negocio: Burger Club - Ushuaia, Argentina.
Datos reales 1 año (Jul 2025 - Abr 2026): 238 días, 2360 órdenes, ticket promedio $30.610.
Ventas promedio por día: Dom $395k (13 ord), Sáb $381k (12 ord), Vie $347k (11 ord), Jue $246k (8 ord), Mar $249k (9 ord), Lun $285k (9 ord), Mié $201k (7 ord).
Pico horario: 21hs ($97k prom). 73% delivery, 27% mostrador.
Producción: medallones 120g, 2.33 medallones/burger promedio.
Medallones recomendados/día: Dom 51, Sáb 48, Vie 43, Jue/Mar 37, Lun 33, Mié 26.
Kg carne/semana: 33 kg. Productos top: Bacon Doble (420u), Bacon Triple (255u), Cheese Doble (207u).
Tendencia: Sep 2025 fue pico ($431k/día), bajó en invierno, se recuperó feb-abr 2026.`,
  lomito: `Negocio: Club del Lomito - Ushuaia, Argentina.
Dark kitchen, mismo equipo que Burger Club. Sin datos de ventas cargados aún.
Hacer recomendaciones generales basadas en el contexto de la cocina compartida.`,
  milanesa: `Negocio: Milanesa - Ushuaia, Argentina.
Dark kitchen, mismo equipo que Burger Club. Sin datos de ventas cargados aún.
Hacer recomendaciones generales basadas en el contexto de la cocina compartida.`,
};

type Mensaje = { role: 'user' | 'assistant'; content: string; timestamp: string };
type Notificacion = { id: number; texto: string; tipo: 'info' | 'alerta' | 'ok'; timestamp: string };

export default function TabMotorIA() {
  const [negocio, setNegocio] = useState('burger');
  const [mensajes, setMensajes] = useState<Record<string, Mensaje[]>>({ burger: [], lomito: [], milanesa: [] });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [autoAnalisis, setAutoAnalisis] = useState(false);

  const msgs = mensajes[negocio] ?? [];
  const negocioInfo = NEGOCIOS.find(n => n.id === negocio)!;

  // Auto-análisis al cargar si no hay mensajes
  useEffect(() => {
    if (msgs.length === 0 && !autoAnalisis) {
      setAutoAnalisis(true);
      const hoy = new Date();
      const diasNombre = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const diaSemana = diasNombre[hoy.getDay()];
      const hora = hoy.getHours();
      const prompt = `Hoy es ${diaSemana} ${hoy.toLocaleDateString('es-AR')} y son las ${hora}hs en Ushuaia. Hacé un análisis rápido del día: qué se espera en ventas, cuánto hay que producir y qué hay que tener en cuenta. Sé concreto y directo, máximo 4 puntos.`;
      handleSend(prompt, true);
    }
  }, [negocio]);

  const addNotificacion = (texto: string, tipo: 'info' | 'alerta' | 'ok') => {
    const notif: Notificacion = {
      id: Date.now(),
      texto,
      tipo,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };
    setNotificaciones(prev => [notif, ...prev].slice(0, 20));
    // Browser notification if permitted
    if (typeof window !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`KitchenOS · ${negocioInfo.label}`, { body: texto, icon: '/icon-192.png' });
    }
  };

  const handleSend = async (textoOverride?: string, silent = false) => {
    const texto = textoOverride ?? input.trim();
    if (!texto || loading) return;
    if (!silent) setInput('');

    const userMsg: Mensaje = {
      role: 'user',
      content: texto,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };

    if (!silent) {
      setMensajes(prev => ({ ...prev, [negocio]: [...(prev[negocio] ?? []), userMsg] }));
    }

    setLoading(true);

    try {
      const historial = silent ? [] : msgs.slice(-8); // Últimos 8 mensajes de contexto

      const systemPrompt = `Sos el motor de inteligencia de KitchenOS, el sistema de gestión de una dark kitchen en Ushuaia, Argentina.
${NEGOCIO_CONTEXT[negocio]}

Tu rol es analizar datos de ventas, proyectar producción y dar recomendaciones concretas.
Hablás en español rioplatense, sos directo y específico. No explicás lo obvio.
Cuando detectás algo importante (sobreproducción, día fuerte, stock crítico) lo decís claramente.
Usás números concretos. Máximo 200 palabras por respuesta.
Si encontrás un insight importante que el admin debería saber urgente, terminá con: [NOTIF: mensaje breve]`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...historial.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: texto },
          ],
        }),
      });

      const data = await response.json();
      const respuesta = data.content?.[0]?.text ?? 'Error al obtener respuesta.';

      // Check for notification trigger
      const notifMatch = respuesta.match(/\[NOTIF:\s*(.+?)\]/);
      if (notifMatch) {
        const tipo = respuesta.toLowerCase().includes('crítico') || respuesta.toLowerCase().includes('urgente') ? 'alerta' : 'info';
        addNotificacion(`${negocioInfo.emoji} ${negocioInfo.label}: ${notifMatch[1]}`, tipo);
      }

      const cleanRespuesta = respuesta.replace(/\[NOTIF:.+?\]/g, '').trim();

      const assistantMsg: Mensaje = {
        role: 'assistant',
        content: cleanRespuesta,
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMensajes(prev => ({
        ...prev,
        [negocio]: [
          ...(silent ? [] : (prev[negocio] ?? [])),
          ...(silent ? [] : []),
          ...(silent ? [assistantMsg] : [assistantMsg]),
        ],
      }));

      if (silent) {
        setMensajes(prev => ({ ...prev, [negocio]: [assistantMsg] }));
      }

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const QUICK_PROMPTS = [
    '¿Cuánto producir hoy?',
    '¿Cómo viene la semana?',
    '¿Qué día es más flojo?',
    'Comparar fin de semana vs semana',
    '¿Cuándo pedir carne?',
    'Resumen del negocio',
  ];

  return (
    <div className="space-y-4">
      {/* Header con selector de negocio */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-purple-400" />
          <h3 className="font-black text-white">Motor de IA</h3>
          <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">BETA</span>
        </div>

        {/* Notificaciones */}
        <button onClick={() => setShowNotifs(v => !v)}
          className="relative flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
          <Bell size={16} className={notificaciones.length > 0 ? 'text-amber-400' : 'text-slate-400'} />
          {notificaciones.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] font-black text-white flex items-center justify-center">
              {notificaciones.length}
            </span>
          )}
          {showNotifs ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>
      </div>

      {/* Panel de notificaciones */}
      {showNotifs && notificaciones.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <p className="font-black text-white text-sm">Alertas del motor</p>
            <button onClick={() => setNotificaciones([])} className="text-xs text-slate-500 hover:text-slate-300">Limpiar</button>
          </div>
          <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
            {notificaciones.map(n => (
              <div key={n.id} className={`px-4 py-3 flex items-start gap-3 ${n.tipo === 'alerta' ? 'bg-red-500/5' : n.tipo === 'ok' ? 'bg-green-500/5' : 'bg-blue-500/5'}`}>
                {n.tipo === 'alerta' ? <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" /> :
                 n.tipo === 'ok' ? <CheckCircle2 size={14} className="text-green-400 shrink-0 mt-0.5" /> :
                 <TrendingUp size={14} className="text-blue-400 shrink-0 mt-0.5" />}
                <p className="text-sm text-slate-300 flex-1">{n.texto}</p>
                <span className="text-xs text-slate-600 shrink-0">{n.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selector de negocio */}
      <div className="flex gap-2">
        {NEGOCIOS.map(n => (
          <button key={n.id} onClick={() => setNegocio(n.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black text-sm transition-all ${negocio === n.id ? n.color : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}>
            <span>{n.emoji}</span> {n.label}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Mensajes */}
        <div className="min-h-64 max-h-96 overflow-y-auto p-4 space-y-4">
          {msgs.length === 0 && loading && (
            <div className="flex items-center gap-3 text-slate-400">
              <RefreshCw size={16} className="animate-spin text-purple-400" />
              <span className="text-sm">Analizando {negocioInfo.label}...</span>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-slate-800 text-slate-200 rounded-bl-sm'}`}>
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={12} className="text-purple-400" />
                    <span className="text-xs font-black text-purple-400">KitchenOS IA</span>
                    <span className="text-xs text-slate-500">{m.timestamp}</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                {m.role === 'user' && <p className="text-xs text-blue-300 text-right mt-1">{m.timestamp}</p>}
              </div>
            </div>
          ))}
          {loading && msgs.length > 0 && (
            <div className="flex items-center gap-2 text-slate-400">
              <RefreshCw size={14} className="animate-spin text-purple-400" />
              <span className="text-xs">Analizando...</span>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        <div className="px-4 py-2 border-t border-slate-800 flex gap-2 overflow-x-auto scrollbar-hide">
          {QUICK_PROMPTS.map(p => (
            <button key={p} onClick={() => handleSend(p)}
              className="shrink-0 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-colors whitespace-nowrap">
              {p}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Preguntale algo sobre ${negocioInfo.label}...`}
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 placeholder-slate-500"
          />
          <button onClick={() => handleSend()} disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center gap-2">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-slate-500">
        <Store size={12} className="shrink-0 mt-0.5" />
        <p>El motor usa datos reales de ventas para generar recomendaciones. Podés preguntarle cualquier cosa sobre producción, ventas, stock o estrategia del negocio.</p>
      </div>
    </div>
  );
}