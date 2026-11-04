// ─────────────────────────────────────────────────────────────────────────────
// Recetas del sistema (fuente única). La usan la cocina (page.tsx) y el admin (costos).
// ─────────────────────────────────────────────────────────────────────────────
import type { Recipe } from '../types';

export const INITIAL_RECIPES: Recipe[] = [
  // ── PANIFICADOS ──────────────────────────────────────────────────────────
  {
    id: 'pan_lomito', name: 'Pan de Lomito', category: 'Panificados',
    baseYield: 82, unit: 'u',
    ingredients: [
      { name: 'Harina 000',        qty: 3000,  unit: 'g' },
      { name: 'Harina 0000',       qty: 6000,  unit: 'g' },
      { name: 'Agua tibia',        qty: 4500,  unit: 'g' },
      { name: 'Levadura',          qty: 90,    unit: 'g' },
      { name: 'Mejormiga',         qty: 108,   unit: 'g' },
      { name: 'Sal',               qty: 112.2, unit: 'g' },
      { name: 'Azúcar',            qty: 180,   unit: 'g' },
      { name: 'Aceite',            qty: 900,   unit: 'g' },
    ]
  },
  // ── SALSAS DE PACK — Fraccionar en potes ────────────────────────────────
  // stockOrigen: 'stock' = materias primas | 'stock_produccion' = producido en cocina
  {
    id: 'frac_mayonesa', name: 'Mayonesa', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock', stockNombre: 'MAYONESA',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'MAYONESA', qty: 1, unit: 'kg' }],
  },
  {
    id: 'frac_ketchup', name: 'Ketchup', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock', stockNombre: 'KETCHUP',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'KETCHUP', qty: 1, unit: 'kg' }],
  },
  {
    id: 'frac_barbacoa', name: 'Barbacoa', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock', stockNombre: 'BARBACOA',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'BARBACOA', qty: 1, unit: 'kg' }],
  },
  {
    id: 'frac_savora', name: 'Savora', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock', stockNombre: 'SAVORA',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'SAVORA', qty: 1, unit: 'kg' }],
  },
  {
    id: 'frac_mostaza', name: 'Mostaza', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock', stockNombre: 'MOSTAZA',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'MOSTAZA', qty: 1, unit: 'kg' }],
  },
  // ── SALSAS DE RECETA — fraccionar lo producido ───────────────────────────
  {
    id: 'frac_salsa_club', name: 'Salsa Club', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock_produccion', stockNombre: 'SALSA CLUB',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'SALSA CLUB', qty: 1, unit: 'kg' }],
  },
  {
    id: 'frac_mayo_mila', name: 'Mayo Mila', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock_produccion', stockNombre: 'MAYO MILA',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'MAYO MILA', qty: 1, unit: 'kg' }],
  },
  {
    id: 'frac_salsa_spread', name: 'Salsa Spread', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock_produccion', stockNombre: 'SALSA SPREAD',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'SALSA SPREAD', qty: 1, unit: 'kg' }],
  },
  {
    id: 'frac_salsa_crema', name: 'Salsa Crema', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock_produccion', stockNombre: 'SALSA CREMA',
    potes: [
      { id: 'crema',   label: 'Pote Crema', capacidadKg: 0.530 },
      { id: 'grande',  label: 'Grande',     capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano',    capacidadKg: 0.850 },
    ],
    ingredients: [{ name: 'SALSA CREMA', qty: 1, unit: 'kg' }],
  },
  {
    id: 'frac_mayo_ajo', name: 'Mayo con Ajo', category: 'Fraccionar',
    baseYield: 0, unit: 'potes', recipeType: 'fraccion',
    stockOrigen: 'stock_produccion', stockNombre: 'SALSA DE AJO',
    potes: [
      { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
      { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
      { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
    ],
    ingredients: [{ name: 'SALSA DE AJO', qty: 1, unit: 'kg' }],
  },

  {
    id: 'salsa_napolitana', name: 'Salsa Napolitana', category: 'Salsas',
    baseYield: 0, unit: 'kg', recipeType: 'percent',
    ingredients: [
      { name: 'Tomate triturado',   qty: 100,  unit: '%', isBase: true },
      { name: 'Cebolla',            qty: 25,   unit: '%' },
      { name: 'Aceite',            qty: 4.17, unit: '%' },
      { name: 'Ajo',               qty: 0.38, unit: '%' },
      { name: 'Sal',               qty: 0.42, unit: '%' },
      { name: 'Orégano',           qty: 0.33, unit: '%' },
      { name: 'Bicarbonato',       qty: 0.07, unit: '%' },
    ]
  },
  // ── VERDURAS PRODUCIDAS ───────────────────────────────────────────────────
  // recipeType: 'verdura' → modal usa flujo peso bruto → neto (sin checklist)
  {
    id: 'verdura_tomate_rodajas', name: 'Tomate cortado', category: 'Verduras',
    baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
  },
  {
    id: 'verdura_lechuga', name: 'Lechuga preparada', category: 'Verduras',
    baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
  },
  {
    id: 'verdura_cebolla_brunoise', name: 'Cebolla brunoise', category: 'Verduras',
    baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
  },
  {
    id: 'verdura_cebolla_rodajas', name: 'Cebolla en rodajas', category: 'Verduras',
    baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
  },
  {
    id: 'verdura_morron', name: 'Morrón preparado', category: 'Verduras',
    baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
  },
  {
    id: 'verdura_ajo', name: 'Ajo preparado', category: 'Verduras',
    baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
  },
  {
    id: 'verdura_verdeo', name: 'Cebolla de verdeo', category: 'Verduras',
    baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
  },

  // ── MILANESAS ─────────────────────────────────────────────────────────────
  {
    id: 'menjunje_carne', name: 'Menjunje Milanesa Carne', category: 'Milanesas',
    baseYield: 10, unit: 'kg base', warning: 'Requiere 24hs Frío',
    ingredients: [
      { name: 'Milanesa - Carne (stock prod.)', qty: 10, unit: 'kg' },
      { name: 'Huevo',    qty: 42,    unit: 'u'  },
      { name: 'Ajo',      qty: 0.125, unit: 'kg' },
      { name: 'Limón',    qty: 0.175, unit: 'kg' },
      { name: 'Sal',      qty: 0.195, unit: 'kg' },
      { name: 'Perejil',  qty: 0.150, unit: 'kg' },
    ]
  },
  {
    id: 'menjunje_pollo', name: 'Menjunje Milanesa Pollo', category: 'Milanesas',
    baseYield: 10, unit: 'kg base', warning: 'Requiere 24hs Frío',
    ingredients: [
      { name: 'Milanesa - Pollo (stock prod.)', qty: 10, unit: 'kg' },
      { name: 'Huevo',    qty: 42,    unit: 'u'  },
      { name: 'Ajo',      qty: 0.125, unit: 'kg' },
      { name: 'Limón',    qty: 0.175, unit: 'kg' },
      { name: 'Sal',      qty: 0.195, unit: 'kg' },
      { name: 'Perejil',  qty: 0.150, unit: 'kg' },
    ]
  },
  // ── FIAMBRES ─────────────────────────────────────────────────────────────
  { id: 'fiambre_jamon',          name: 'Jamón',                category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
  { id: 'fiambre_panceta',        name: 'Panceta',              category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
  { id: 'fiambre_cheddar_feta',   name: 'Cheddar en Feta',      category: 'Fiambres', baseYield: 0, unit: 'u',  recipeType: 'fiambre', ingredients: [] },
  { id: 'fiambre_cheddar_liq',    name: 'Cheddar Líquido',      category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
  { id: 'fiambre_cheddar_burger', name: 'Cheddar para Burger',  category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
  { id: 'fiambre_provoleta',      name: 'Provoleta',            category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
  { id: 'fiambre_muzza_sanguch',    name: 'Queso Muzza para Sanguchería', category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
  { id: 'fiambre_muzza_mila',       name: 'Queso Muzza para Mila al Plato', category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
  { id: 'fiambre_tybo',           name: 'Queso Tybo',           category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },

  // ── EMPANADO MILANESA ─────────────────────────────────────────────────────
  { id: 'empanado_carne', name: 'Empanado Milanesa Carne', category: 'Milanesas', baseYield: 0, unit: 'kg',
    recipeType: 'empanado' as any,
    warning: 'Usa menjunje de carne del stock de producción',
    ingredients: [] },
  { id: 'empanado_pollo', name: 'Empanado Milanesa Pollo', category: 'Milanesas', baseYield: 0, unit: 'kg',
    recipeType: 'empanado' as any,
    warning: 'Usa menjunje de pollo del stock de producción',
    ingredients: [] },

  // ── SALSAS PRODUCCIÓN ─────────────────────────────────────────────────────
  { id: 'salsa_club',    name: 'Salsa Club',    category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
    ingredients: [
      { name: 'Aceite',  qty: 100, unit: '%', isBase: true },
      { name: 'Leche',   qty: 1,   unit: '%' },
      { name: 'Sal',     qty: 0.5, unit: '%' },
      { name: 'Ajo',     qty: 2,   unit: '%' },
    ]},
  { id: 'salsa_mayo_mila', name: 'Mayo Mila', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
    ingredients: [
      { name: 'Mayonesa',  qty: 100, unit: '%', isBase: true },
      { name: 'Ajo',       qty: 1.5, unit: '%' },
      { name: 'Limón',     qty: 1,   unit: '%' },
    ]},
  { id: 'salsa_spread', name: 'Salsa Spread', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
    ingredients: [
      { name: 'Mayonesa', qty: 100, unit: '%', isBase: true },
      { name: 'Ketchup',  qty: 20,  unit: '%' },
      { name: 'Relish',   qty: 5,   unit: '%' },
      { name: 'Vinagre',  qty: 0.3, unit: '%' },
      { name: 'Azúcar',   qty: 0.3, unit: '%' },
    ]},
  { id: 'salsa_crema', name: 'Salsa Crema', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
    ingredients: [
      { name: 'Queso crema', qty: 100, unit: '%', isBase: true },
      { name: 'Mayonesa',    qty: 20,  unit: '%' },
    ]},
  { id: 'salsa_ajo', name: 'Salsa de Ajo', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
    ingredients: [
      { name: 'Mayonesa',  qty: 100, unit: '%', isBase: true },
      { name: 'Ajo',       qty: 8,   unit: '%' },
    ]},
  { id: 'salsa_criolla', name: 'Criolla', category: 'Salsas', baseYield: 1.21, unit: 'kg',
    ingredients: [
      { name: 'Morrón colorado',      qty: 210, unit: 'g' },
      { name: 'Morrón verde',         qty: 210, unit: 'g' },
      { name: 'Cebolla',             qty: 260, unit: 'g' },
      { name: 'Tomate de cajón',      qty: 420, unit: 'g' },
      { name: 'Sal',                 qty: 10,  unit: 'g' },
      { name: 'Aceite',              qty: 50,  unit: 'g' },
      { name: 'Vinagre',             qty: 50,  unit: 'g' },
    ]},

  // ── PREP / FRITURA ────────────────────────────────────────────────────────
  { id: 'crispy_cebolla', name: 'Cebolla Crispy', category: 'Prep', baseYield: 0, unit: 'kg', recipeType: 'percent',
    stockNombre: 'Cebolla Crispy',
    ingredients: [
      { name: 'CEBOLLA',   qty: 100,  unit: '%', isBase: true },
      { name: 'Harina',    qty: 93,   unit: '%' },
      { name: 'Leche',     qty: 39,   unit: '%' },
      { name: 'Sal',       qty: 1.5,  unit: '%' },
      { name: 'Pimienta',  qty: 0.8,  unit: '%' },
    ]},

  // ── PANADERÍA ─────────────────────────────────────────────────────────────
  { id: 'pan_sanguchero', name: 'Pan Sanguchero', category: 'Panificados', baseYield: 30, unit: 'u',
    ingredients: [
      { name: 'Harina 000',        qty: 1570,  unit: 'g' },
      { name: 'Harina 0000',       qty: 1570,  unit: 'g' },
      { name: 'Agua tibia',        qty: 1570,  unit: 'g' },
      { name: 'Levadura',          qty: 31.4,  unit: 'g' },
      { name: 'Mejorador concentrado', qty: 1.57, unit: 'g' },
      { name: 'Mejormiga',         qty: 37.68, unit: 'g' },
      { name: 'Sal',               qty: 62.80, unit: 'g' },
      { name: 'Azúcar',            qty: 62.80, unit: 'g' },
      { name: 'Aceite',            qty: 219.8, unit: 'g' },
    ]},
];
