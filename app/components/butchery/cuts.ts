import { ButcheryProductionType } from '../../types';

// --- TIPOS DE PRODUCCIÓN (pantalla inicial) ---
export type ProductionKind = 'limpieza' | 'lomito' | 'burger' | 'milanesa';

export type ProductionKindConfig = {
  id: ProductionKind;
  label: string;
  emoji: string;
  color: string;        // bg del botón seleccionado
  borderColor: string;
  textColor: string;
  description: string;
};

export const PRODUCTION_KINDS: ProductionKindConfig[] = [
  {
    id: 'limpieza',
    label: 'LIMPIEZA',
    emoji: '🔪',
    color: 'bg-slate-700',
    borderColor: 'border-slate-500',
    textColor: 'text-slate-700',
    description: 'Limpieza de carne — genera carne limpia y grasa',
  },
  {
    id: 'lomito',
    label: 'LOMITO',
    emoji: '🥩',
    color: 'bg-rose-600',
    borderColor: 'border-rose-400',
    textColor: 'text-rose-700',
    description: 'Procesamiento de lomitos',
  },
  {
    id: 'burger',
    label: 'BURGER',
    emoji: '🍔',
    color: 'bg-blue-600',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-700',
    description: 'Elaboración de burgers',
  },
  {
    id: 'milanesa',
    label: 'MILANESA',
    emoji: '🥪',
    color: 'bg-amber-600',
    borderColor: 'border-amber-400',
    textColor: 'text-amber-700',
    description: 'Preparación de milanesas',
  },
];

// --- CORTES POR TIPO ---
export type CutConfig = {
  id: ButcheryProductionType;
  label: string;
  emoji: string;
  stockDestino: string;
  defaultUnit: 'unid' | 'kg';
  kinds: ProductionKind[]; // a qué tipos pertenece este corte
};

export const CUTS: CutConfig[] = [
  { id: 'lomo',         label: 'Lomo',            emoji: '🥩', stockDestino: 'Stock Lomo',            defaultUnit: 'unid', kinds: ['lomito', 'milanesa'] },
  { id: 'roast_beef',   label: 'Roast Beef',      emoji: '🥩', stockDestino: 'Stock Roast Beef',      defaultUnit: 'kg',   kinds: ['lomito', 'burger', 'milanesa'] },
  { id: 'tapa_asado',   label: 'Tapa de Asado',   emoji: '🥩', stockDestino: 'Stock Tapa de Asado',   defaultUnit: 'unid', kinds: ['lomito', 'burger', 'milanesa'] },
  { id: 'tapa_nalga',   label: 'Tapa de Nalga',   emoji: '🥩', stockDestino: 'Stock Tapa de Nalga',   defaultUnit: 'unid', kinds: ['lomito', 'burger', 'milanesa'] },
  { id: 'bife_chorizo', label: 'Bife de Chorizo',  emoji: '🥩', stockDestino: 'Stock Bife de Chorizo', defaultUnit: 'unid', kinds: ['lomito', 'burger', 'milanesa'] },
  { id: 'vacio',        label: 'Vacío',            emoji: '🥩', stockDestino: 'Stock Vacío',           defaultUnit: 'kg',   kinds: ['lomito', 'burger', 'milanesa'] },
  { id: 'picana',       label: 'Picaña',           emoji: '🥩', stockDestino: 'Stock Picaña',          defaultUnit: 'unid', kinds: ['lomito', 'burger', 'milanesa'] },
  { id: 'ojo_bife',     label: 'Ojo de Bife',      emoji: '🥩', stockDestino: 'Stock Ojo de Bife',     defaultUnit: 'unid', kinds: ['lomito', 'burger', 'milanesa'] },
  { id: 'grasa_pella',  label: 'Grasa de Pella',   emoji: '🫙', stockDestino: 'Stock Grasa de Pella',  defaultUnit: 'kg',   kinds: ['lomito', 'burger', 'milanesa'] },
  { id: 'pollo',        label: 'Pollo',           emoji: '🍗', stockDestino: 'Stock Pollo',           defaultUnit: 'kg',   kinds: ['milanesa'] },
  { id: 'cuadril',      label: 'Cuadril',         emoji: '🥩', stockDestino: 'Stock Cuadril',         defaultUnit: 'unid', kinds: ['lomito', 'milanesa'] },
  { id: 'not_burger',   label: 'Not Burger',      emoji: '🌱', stockDestino: 'Stock Not Burger',      defaultUnit: 'unid', kinds: ['burger'] },
  { id: 'cuadrada',     label: 'Cuadrada',        emoji: '🥩', stockDestino: 'Stock Cuadrada',        defaultUnit: 'unid', kinds: ['lomito', 'milanesa'] },
];

// Filtra cortes por tipo de producción
export function getCutsByKind(kind: ProductionKind): CutConfig[] {
  return CUTS.filter(c => c.kinds.includes(kind));
}

export const ALL_STOCKS: string[] = [
  'Stock Roast Beef',
  'Stock Tapa de Asado',
  'Stock Tapa de Nalga',
  'Stock Bife de Chorizo',
  'Stock Vacío',
  'Stock Picaña',
  'Stock Ojo de Bife',
  'Stock Grasa de Pella',
  'Stock Burger',
  'Stock Carne Picada',
  'Stock Milanesas',
];

export function getCut(type: ButcheryProductionType): CutConfig {
  return CUTS.find(c => c.id === type) ?? CUTS[0];
}
export function getCutLabel(type: ButcheryProductionType): string {
  return getCut(type).label;
}

export function formatTimer(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const hrs  = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
export function formatWeight(kg: number): string { return kg.toFixed(3).replace(/\.?0+$/, '').replace('.', ','); }
export function formatGrams(gr: number): string   { return gr.toFixed(0); }

export function getCarneLinpiaName(corte: string, destino: 'burger' | 'carne_limpia'): string {
  const norm = corte.toLowerCase().includes('nalga') ? 'Nalga' : corte;
  return destino === 'burger' ? `Carne Limpia Burger - ${norm}` : `${norm} Limpia`;
}