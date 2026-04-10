// --- TIPOS DE DATOS COMPARTIDOS ---

export type Ingredient = { 
  name: string; 
  qty: number;        // cantidad fija O porcentaje según recipeType
  unit: string;       // 'kg', 'lt', 'u', 'gr', '%'
  isBase?: boolean;   // true = ingrediente base (100%) en recetas porcentuales
};

export type Recipe = {
  id: string;
  name: string;
  category: string;
  baseYield: number;
  unit: string;
  ingredients: Ingredient[];
  warning?: string;
  recipeType?: 'percent' | 'fixed' | 'verdura' | 'fraccion'; // 'percent' = todo en % del ingrediente base
};

export type ProductionRecord = {
  id: number;
  date: string;
  timestamp: number;
  recipeName: string;
  quantity: number;
  unit: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
};

export type Supplier = {
  id: number;
  name: string;
  categories: string[];
  cuit: string;
  phone: string;
  email: string;
  address: string;
  days: string[];
};

export type ActiveProduction = {
  id: number;
  recipeName: string;
  recipeId?: string;
  targetUnits: number;
  unit: string;
  startTime: number;
  status: 'running';
  operador?: string;
  baseKg?: number;
} | null;

export type ActiveProductionItem = NonNullable<ActiveProduction>;

// --- CARNICERÍA ---

export type ButcheryProductionType = 'lomo' | 'roast_beef' | 'tapa_asado' | 'tapa_nalga' | 'bife_chorizo' | 'vacio' | 'picana' | 'ojo_bife' | 'grasa_pella' | 'pollo' | 'cuadril' | 'cuadrada' | 'not_burger';

export type ButcheryProductionStatus = 'step1_running' | 'step1_done' | 'step2_pending' | 'step2_running' | 'step2_done';

export type ButcheryProduction = {
  id: number;
  batchId: number;          // ID compartido entre todos los cortes del mismo lote
  kind?: string;            // 'lomito' | 'burger' | 'milanesa'
  type: ButcheryProductionType;
  typeName: string;
  cut: string;
  weightKg: number;
  startTime: number;
  endTime?: number;
  durationSeconds?: number;
  status: ButcheryProductionStatus;
  date: string;
  startTimeFormatted: string;
  endTimeFormatted?: string;
  // Paso 2
  step2StartTime?: number;
  step2EndTime?: number;
  finalProductName?: string;
  quantityProduced?: number;
  wasteKg?: number;
  netWeightKg?: number;
  avgWeightPerUnit?: number;
};

// Stock simplificado (en memoria por ahora)
export type StockItem = {
  id: string;
  name: string;
  category: string;
  currentKg: number;
};

// Registro completo de producción de carnicería para exportar
export type ButcheryRecord = {
  id: number;
  date: string;
  kind?: string;           // 'lomito' | 'burger' | 'milanesa'
  type: ButcheryProductionType;
  typeName: string;
  cut: string;
  brutoPesoKg: number;
  finalProduct: string;
  quantityProduced: number;
  wasteKg: number;
  netWeightKg: number;
  avgWeightPerUnitGr: number;
  step1Start: string;
  step1End: string;
  step1DurationMin: number;
  step2Start: string;
  step2End: string;
};