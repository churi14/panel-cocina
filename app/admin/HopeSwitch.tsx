"use client";
import React, { useId, useLayoutEffect, useRef, useState } from 'react';

export type SwitchOption<T extends string> = { id: T; label: React.ReactNode; tone?: 'green' | 'red' };

/**
 * Switch segmentado con indicador deslizante (estilo "flip" de jh3y).
 * - Usa radios ocultos: funciona con teclado (flechas) y lectores de pantalla.
 * - El indicador se mide contra la opción elegida, así que sirve con opciones de ancho distinto.
 * - `fit`: las opciones toman su ancho natural y, si no entran, la barra se desplaza.
 * Las medidas, el resorte (linear()) y los colores están en globals.css (.hp-switch).
 */
export default function HopeSwitch<T extends string>({ options, value, onChange, name, fit = false, block = false }: {
  options: SwitchOption<T>[];
  value: T;
  onChange: (id: T) => void;
  name?: string;
  fit?: boolean;
  /** Ocupa todo el ancho disponible, con las opciones repartidas en partes iguales. */
  block?: boolean;
}) {
  const uid = useId();
  const group = name ?? `sw-${uid}`;
  const idx = Math.max(0, options.findIndex(o => o.id === value));
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<{ x: number; w: number } | null>(null);
  const primera = useRef(true);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const medir = () => {
      const el = root.querySelector<HTMLLabelElement>('input:checked + label');
      if (!el) return;
      setM(prev => (prev && prev.x === el.offsetLeft && prev.w === el.offsetWidth) ? prev : { x: el.offsetLeft, w: el.offsetWidth });
    };
    medir();
    // Mantener visible la opción elegida cuando la barra se desplaza (no en el primer render)
    if (!primera.current) {
      root.querySelector<HTMLLabelElement>('input:checked + label')
        ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
    primera.current = false;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(root);
    root.querySelectorAll('label').forEach(l => ro.observe(l));
    return () => ro.disconnect();
  }, [value, options.length]);

  const style: Record<string, string | number> = { '--n': options.length, '--i': idx };
  if (m) { style['--dx'] = `${m.x - 3}px`; style['--w'] = `${m.w}px`; }
  const tono = options[idx]?.tone;
  if (tono) { style['--ind'] = tono === 'green' ? '#16a34a' : '#dc2626'; style['--ind-shadow'] = tono === 'green' ? 'rgba(22,163,74,.7)' : 'rgba(220,38,38,.7)'; }

  return (
    <div ref={ref} className={`hp-switch ${fit ? 'fit' : ''} ${block ? 'block' : ''}`} role="radiogroup" style={style as React.CSSProperties}>
      <span className="hp-switch-ind" aria-hidden="true" />
      {options.map(o => (
        <React.Fragment key={o.id}>
          <input type="radio" className="sr-only" name={group} id={`${group}-${o.id}`}
            checked={o.id === value} onChange={() => onChange(o.id)} />
          <label htmlFor={`${group}-${o.id}`}>{o.label}</label>
        </React.Fragment>
      ))}
    </div>
  );
}
