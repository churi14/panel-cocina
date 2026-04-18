"use client";

import React, { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';
import { ButcheryProduction } from '../../types';
import { formatTimer, formatWeight } from './cuts';

export function ProductionCard({ production }: {
  production: ButcheryProduction;
}) {
  const [now, setNow] = useState(Date.now());
  const isStep1Running = production.status === 'step1_running';
  const isStep1Done    = production.status === 'step2_pending';
  const isStep2Running = production.status === 'step2_running';

  useEffect(() => {
    if (!isStep1Running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isStep1Running]);

  const elapsed = isStep1Running
    ? now - production.startTime
    : (production.durationSeconds || 0) * 1000;

  const headerBg   = isStep1Running ? 'bg-rose-600' : isStep2Running ? 'bg-blue-600' : 'bg-green-600';
  const cardBorder = isStep1Running ? 'border-rose-200 bg-rose-50' : isStep2Running ? 'border-blue-300 bg-blue-50' : 'border-green-300 bg-green-50';
  const timerColor = isStep1Running ? 'text-rose-700' : isStep2Running ? 'text-blue-700' : 'text-green-700';

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${cardBorder}`}>
      {/* Header compacto */}
      <div className={`px-3 py-2 flex items-center justify-between ${headerBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">🥩</span>
          <div className="min-w-0">
            <h3 className="text-white font-black text-sm leading-tight truncate">{production.typeName}</h3>
            <p className="text-white/75 text-xs">{formatWeight(production.weightKg)} KG</p>
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {isStep1Running && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"/>
              <span className="text-white/80 text-[10px] font-bold uppercase hidden sm:inline">PASO 1</span>
            </div>
          )}
          {isStep1Done && (
            <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              ✓ P2
            </span>
          )}
          {isStep2Running && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"/>
              <span className="text-white/80 text-[10px] font-bold uppercase">PASO 2</span>
            </div>
          )}
        </div>
      </div>

      {/* Timer compacto */}
      <div className="px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer size={14} className={timerColor} />
          <span className={`text-xl font-mono font-black tracking-wide ${timerColor}`}>
            {formatTimer(elapsed)}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 text-right">
          {production.startTimeFormatted}
          {production.endTimeFormatted && <><br/>→ {production.endTimeFormatted}</>}
        </p>
      </div>
    </div>
  );
}