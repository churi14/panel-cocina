"use client";
import React, { useId } from 'react';

export type SwitchOption<T extends string> = { id: T; label: React.ReactNode };

/**
 * Switch segmentado con indicador deslizante (estilo "flip" de jh3y).
 * Usa radios ocultos: funciona con teclado (flechas) y lectores de pantalla.
 * Las medidas, el resorte (linear()) y los colores están en globals.css (.hp-switch).
 */
export default function HopeSwitch<T extends string>({ options, value, onChange, name }: {
  options: SwitchOption<T>[];
  value: T;
  onChange: (id: T) => void;
  name?: string;
}) {
  const uid = useId();
  const group = name ?? `sw-${uid}`;
  const idx = Math.max(0, options.findIndex(o => o.id === value));

  return (
    <div className="hp-switch" role="radiogroup"
      style={{ '--n': options.length, '--i': idx } as React.CSSProperties}>
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
