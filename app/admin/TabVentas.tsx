"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import {
  Upload, CheckCircle2, AlertTriangle, RefreshCw, X,
  TrendingUp, ShoppingBag, Truck, CreditCard, Banknote,
  BarChart3, Package, ChevronDown, ChevronUp, Store
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkAndNotifyStock } from '../components/pushEvents';

// ─── Config de locales ────────────────────────────────────────────────────────
const LOCALES = [
  { id: 'burger',   label: '🍔 Burger',         color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  bar: 'bg-blue-500',  hex: '#3b82f6' },
  { id: 'lomito',   label: '🥩 Club del Lomito', color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30',  bar: 'bg-rose-500',  hex: '#f43f5e' },
  { id: 'milanesa', label: '🥪 Milanesa',        color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', bar: 'bg-amber-500', hex: '#f59e0b' },
] as const;
type LocalId = 'burger' | 'lomito' | 'milanesa';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type VentaProducto = {
  fecha: string; categoria: string; producto: string;
  cantidad: number; monto_total: number; local: LocalId;
};
type VentaOrden = {
  id: number; fecha: string | null; creacion: string | null; cerrada: string | null;
  cliente: string | null; medio_pago: string | null; total: number; fiscal: boolean;
  tipo_venta: string | null; origen: string | null; comentario: string | null;
  local: LocalId;
};
type ParseResult = {
  productos: VentaProducto[]; ordenes: VentaOrden[];
  fechaDesde: string; fechaHasta: string;
  errorProductos?: string; errorOrdenes?: string;
};


// ─── Mapa de recetas ──────────────────────────────────────────────────────────
type RecetaIngrediente = {
  ingrediente: string; cantidad: number; unidad: string;
  stock_nombre: string | null; stock_cat: string | null;
  stock_tipo: 'stock' | 'stock_produccion' | 'ignorar';
};
const RECETAS_MAP: Record<string, RecetaIngrediente[]> = {"BACON SIMPLE": [{"ingrediente": "Medallón Burger", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan de hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Panceta", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Barbacoa", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "BACON DOBLE": [{"ingrediente": "Medallón Burger", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan de hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Panceta", "cantidad": 0.08, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Barbacoa", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "BACON TRIPLE": [{"ingrediente": "Medallón Burger", "cantidad": 3.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan de hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Panceta", "cantidad": 0.08, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Barbacoa", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "BACON CUADRUPLE": [{"ingrediente": "Medallón Burger", "cantidad": 3.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan de hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Panceta", "cantidad": 0.08, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Barbacoa", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "BACON JAM SIMPLE": [{"ingrediente": "Medallón Burger", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan de hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mermelada de bacon", "cantidad": 0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "creamcheese", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "QUESO CREMA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "BACON JAM DOBLE": [{"ingrediente": "Medallón Burger", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mermelada de bacon", "cantidad": 0.02, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "creamcheese", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "QUESO CREMA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "BACON JAM TRIPLE": [{"ingrediente": "Medallón Burger", "cantidad": 3.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mermelada de bacon", "cantidad": 0.02, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "creamcheese", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "QUESO CREMA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "CHEESE SIMPLE": [{"ingrediente": "Medallón Burger", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "CHEESE DOBLE": [{"ingrediente": "Medallón Burger", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.07, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "CHEESE TRIPLE": [{"ingrediente": "Medallón Burger", "cantidad": 3.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.07, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "CHEESE CUADRUPLE": [{"ingrediente": "Medallón Burger", "cantidad": 4.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.07, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LA CLUB SIMPLE": [{"ingrediente": "Medallón Burger", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.07, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "salsa de queso crema", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "salsa spread", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.2, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LA CLUB DOBLE": [{"ingrediente": "Medallón Burger", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.07, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "salsa de queso crema", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "salsa spread", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.2, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LA CLUB TRIPLE": [{"ingrediente": "Medallón Burger", "cantidad": 3.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "salsa de queso crema", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "salsa spread", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.2, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "PEAKY DOBLE": [{"ingrediente": "Medallón Burger", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "pepino", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "PEPINO ENCURTIDO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "lechuga", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "PEAKY TRIPLE": [{"ingrediente": "Medallón Burger", "cantidad": 3.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "pepino", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "PEPINO ENCURTIDO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "lechuga", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "ANIMAL STYLE SIMPLE": [{"ingrediente": "Medallón Burger", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.04, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "lechuga", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "pepino", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "PEPINO ENCURTIDO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "ANIMAL STYLE DOBLE": [{"ingrediente": "Medallón Burger", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.06, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.04, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "lechuga", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "pepino", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "PEPINO ENCURTIDO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "ANIMAL STYLE TRIPLE": [{"ingrediente": "Medallón Burger", "cantidad": 3.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.04, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "lechuga", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "pepino", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "PEPINO ENCURTIDO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "NOT BURGER LA CLUB": [{"ingrediente": "medallon vegetal not", "cantidad": 2.0, "unidad": "u", "stock_nombre": "NOT", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "salsa de queso crema", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "salsa spread", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.04, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "NOT BURGER CHEESE": [{"ingrediente": "medallon vegetal not", "cantidad": 2.0, "unidad": "u", "stock_nombre": "NOT", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "ketchup", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "KETCHUP", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "mayonesa clasica", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "cebolla brunoise", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "CEBOLLA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "CUARTO DE LIBRA SIMPLE": [{"ingrediente": "Medallón Burger", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Medallones Burger", "stock_cat": "burger", "stock_tipo": "stock_produccion"}, {"ingrediente": "Pan hamburguesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAN KALIS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "ketchup", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "KETCHUP", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "cebolla brunoise", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "CEBOLLA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "pepino", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "PEPINO ENCURTIDO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "bolsa kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja", "cantidad": 1.0, "unidad": "u", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "PROMO LOMITO 2X1": [{"ingrediente": "Lomito", "cantidad": 0.3, "unidad": "u", "stock_nombre": "LOMO", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan de Lomito", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "tomate", "cantidad": 0.08, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "lechuga", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "huevo", "cantidad": 2.0, "unidad": "u", "stock_nombre": "HUEVO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "jamon", "cantidad": 0.06, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "queso tybo", "cantidad": 0.06, "unidad": "kg", "stock_nombre": "QUESO TYBO", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mayo club", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "salsa club", "cantidad": 0.03, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 2.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 2.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO SIMPLE": [{"ingrediente": "Lomito - Lomo", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "LOMO", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "lechuga", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "huevo", "cantidad": 1.0, "unidad": "u", "stock_nombre": "HUEVO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "jamon", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "queso tybo", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "QUESO TYBO", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mayo club", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "salsa club", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO VEGGY VERDURAS": [{"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "mayo clasica", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "salteado de verduras", "cantidad": 0.18, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "queso mozzarella", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "tomates secos", "cantidad": 0.3, "unidad": "kg", "stock_nombre": "TOMATE SECOS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO PROVOLETA": [{"ingrediente": "Lomito - Lomo", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "LOMO", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "Provoleta", "cantidad": 0.14, "unidad": "kg", "stock_nombre": "PROVOLETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "oregano", "cantidad": 0.005, "unidad": "kg", "stock_nombre": "OREGANO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "huevo", "cantidad": 1.0, "unidad": "u", "stock_nombre": "HUEVO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "morron", "cantidad": 0.06, "unidad": "kg", "stock_nombre": "MORRON", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "aji molido", "cantidad": 0.005, "unidad": "kg", "stock_nombre": "AJÍ MOLIDO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Mayonesa de la casa", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO AMERICANO": [{"ingrediente": "Lomito - Lomo", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "LOMO", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "Queso cheddar", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "panceta", "cantidad": 0.5, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "barbacoa", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO OKLAHOMA": [{"ingrediente": "Lomito - Lomo", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "LOMO", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "Queso cheddar", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "mayo club", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "salsa club", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO CRIOLLO": [{"ingrediente": "Lomito - Lomo", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "LOMO", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "lechuga", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "jamon", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "queso", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "salsa criolla", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "mayo club", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "salsa club", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO VEGETARIANO": [{"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "provoleta", "cantidad": 0.14, "unidad": "kg", "stock_nombre": "PROVOLETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "lechuga", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "huevo", "cantidad": 1.0, "unidad": "u", "stock_nombre": "HUEVO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "morron", "cantidad": 0.06, "unidad": "kg", "stock_nombre": "MORRON", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.06, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "mayo club", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "salsa club", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO AMERICANO DELUX": [{"ingrediente": "Lomito - Lomo", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "LOMO", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "Queso cheddar", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "panceta", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "barbacoa", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "LOMITO NAPOLITANO": [{"ingrediente": "Lomito - Lomo", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "LOMO", "stock_cat": "CARNES", "stock_tipo": "stock"}, {"ingrediente": "Pan de Lomito", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan de Lomito", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "jamon", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mozzarella", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "tomates secos", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE SECOS", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "oregano", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "OREGANO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "salsa club", "cantidad": 0.03, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sticker", "cantidad": 1.0, "unidad": "u", "stock_nombre": "ETIQUETAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "CAJA DE PAPAS CHICAS": [{"ingrediente": "papas congeladas", "cantidad": 0.3, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "CAJAS DE PAPAS MEDIANAS": [{"ingrediente": "papas congeladas", "cantidad": 0.5, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "CAJA DE PAPAS GRANDES": [{"ingrediente": "papas congeladas", "cantidad": 0.75, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "PROMO MILA CLASICA 2X1": [{"ingrediente": "Milanesa", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "lechuga", "cantidad": 0.08, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.08, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "mayonesa clasica", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 2.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "PROMO SUPREMA CLASICA 2X1": [{"ingrediente": "Milanesa", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 2.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "lechuga", "cantidad": 0.08, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.08, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "mayonesa clasica", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 2.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "MILANESA AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.2, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "MILANESA NAPOLITANA AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "salsa de tomate", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "jamon", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mozzarella", "cantidad": 0.12, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.4, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "oregano", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "OREGANO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 1.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "MILANESA BACON AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "panceta", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "MILANESA CEBOLLA CARAMELIZADA AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "queso mozzarella", "cantidad": 0.12, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "salsa de tomate", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "MILANESA PORTEÑA AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "queso mozzarella", "cantidad": 0.12, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "salsa de tomate", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "chimi pesto", "cantidad": 0.02, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "SUPREMA AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.2, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "SUPREMA NAPOLITANA AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "salsa de tomate", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "jamon", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mozzarella", "cantidad": 0.12, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.4, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "oregano", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "OREGANO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "SUPREMA BACON AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "panceta", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Queso cheddar", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "SUPREMA CEBOLLA CARAMELIZADA AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "queso mozzarella", "cantidad": 0.12, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "salsa de tomate", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "SUPREMA PORTEÑA AL PLATO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "queso mozzarella", "cantidad": 0.12, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "salsa de tomate", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "chimi pesto", "cantidad": 0.02, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "u", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "MILANESA BOX": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.5, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "SUPREMA BOX": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.5, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}], "SIMPLE TUCUMANO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "lechuga", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "mayonesa clasica", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "CLASICO TUCUMANO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "lechuga", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "mayonesa clasica", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "ESPECIAL CEBOLLA TUCUMANO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "lechuga", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "mayonesa clasica", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.04, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "NAPOLITANO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "jamon", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "queso mozzarella", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "salsa de club", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "oregano", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "OREGANO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "CRIOLLO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "jamon", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "queso mozzarella", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "lechuga", "cantidad": 0.02, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "salsa criolla", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "salsa club", "cantidad": 0.015, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "CHEDDAR": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "Queso cheddar", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "barbacoa", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "CARAMELIZADO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Queso cheddar", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "mayonesa clasica", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "DELUX": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "panceta", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Queso cheddar", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "barbacoa", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "PROVOLETA": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "queso provoleta", "cantidad": 0.14, "unidad": "kg", "stock_nombre": "PROVOLETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "ají", "cantidad": 0.01, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "oregano", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "OREGANO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "morron", "cantidad": 0.06, "unidad": "kg", "stock_nombre": "MORRON", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "mayonesa de ajo", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "SUPREMA CLASICO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "lechuga", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "LECHUGA", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "mayonesa clasica", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "MAYONESA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "mostaza", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "SAVORA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "SUPREMA NAPOLITANO": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "jamon", "cantidad": 0.03, "unidad": "kg", "stock_nombre": "JAMÓN", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "queso mozzarella", "cantidad": 0.1, "unidad": "kg", "stock_nombre": "QUESO MUZZA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "tomate", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "TOMATE", "stock_cat": "VERDURA", "stock_tipo": "stock"}, {"ingrediente": "salsa de club", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "oregano", "cantidad": 0.01, "unidad": "kg", "stock_nombre": "OREGANO", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}], "SUPREMA DELUX": [{"ingrediente": "Milanesa", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Milanesa", "stock_cat": "milanesa", "stock_tipo": "stock_produccion"}, {"ingrediente": "pan sanguchero", "cantidad": 1.0, "unidad": "u", "stock_nombre": "Pan Sanguchero", "stock_cat": "lomito", "stock_tipo": "stock_produccion"}, {"ingrediente": "panceta", "cantidad": 0.05, "unidad": "kg", "stock_nombre": "PANCETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "cebolla caramelizada", "cantidad": 0.05, "unidad": "kg", "stock_nombre": null, "stock_cat": null, "stock_tipo": "ignorar"}, {"ingrediente": "Queso cheddar", "cantidad": 0.04, "unidad": "kg", "stock_nombre": "CHEDDAR EN FETA", "stock_cat": "FIAMBRE", "stock_tipo": "stock"}, {"ingrediente": "barbacoa", "cantidad": 0.015, "unidad": "kg", "stock_nombre": "BARBACOA", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "Papel aluminio", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ALUMINIO LOMITOS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papel parafinado", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL ENCERADO A CUADROS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "caja kraft", "cantidad": 1.0, "unidad": "u", "stock_nombre": "PAPEL KRAFT", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}, {"ingrediente": "papas congeladas", "cantidad": 0.15, "unidad": "kg", "stock_nombre": "PAPAS MCCAIN", "stock_cat": "SECOS", "stock_tipo": "stock"}, {"ingrediente": "sobre de papas", "cantidad": 2.0, "unidad": "u", "stock_nombre": "SOBRE PARA PAPAS", "stock_cat": "DESCARTABLES", "stock_tipo": "stock"}]};

type StockDescuento = {
  stock_nombre: string; stock_cat: string | null;
  stock_tipo: 'stock' | 'stock_produccion';
  cantidad_total: number; unidad: string; productos: string[];
};

function calcularDescuentos(productos: VentaProducto[]): StockDescuento[] {
  const map: Record<string, StockDescuento> = {};
  for (const venta of productos) {
    // Normalizar nombre: quitar tildes, limpiar espacios, alias de Fudo
    const normalizarNombre = (s: string) => s.toUpperCase().trim()
      .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I').replace(/Ó/g,'O').replace(/Ú/g,'U')
      .replace(/  +/g, ' ');
    
    const FUDO_ALIASES: Record<string,string> = {
      // Bebidas — se ignoran para descuento de stock (son unidades)
      'BROLA DE CALAFATE': 'BROLA CALAFATE',
      'BROLA DE ROCKLETS': 'BROLA ROCKLETS',
      'BROLAS KINDER': 'BROLA KINDER',
      // Combos y genericos — ignorar
      'COMBO DUO 1': '__IGNORAR__',
      'COMBO DUO INDIVIDUAL': '__IGNORAR__',
      'COSTO DE ENVIOO': '__IGNORAR__',
      'PRODUCTO GENERICO': '__IGNORAR__',
      'EL COSTO DE ENVIO SE COTIZA UNA VEZ REALIZADO EL PEDIDO !': '__IGNORAR__',
      'PROMO 2X1 CHESSE IS LOVE': '__IGNORAR__',
    };

    const nombreNorm = normalizarNombre(venta.producto);
    const nombreFinal = FUDO_ALIASES[nombreNorm] ?? nombreNorm;
    if (nombreFinal === '__IGNORAR__') continue;
    const receta = RECETAS_MAP[nombreFinal];
    if (!receta) continue;
    for (const ing of receta) {
      if (ing.stock_tipo === 'ignorar' || !ing.stock_nombre) continue;
      const key = `${ing.stock_nombre}__${ing.stock_tipo}`;
      if (!map[key]) map[key] = {
        stock_nombre: ing.stock_nombre, stock_cat: ing.stock_cat,
        stock_tipo: ing.stock_tipo as 'stock' | 'stock_produccion',
        cantidad_total: 0, unidad: ing.unidad, productos: [],
      };
      map[key].cantidad_total += ing.cantidad * venta.cantidad;
      if (!map[key].productos.includes(venta.producto)) map[key].productos.push(venta.producto);
    }
  }
  return Object.values(map).sort((a, b) => a.stock_nombre.localeCompare(b.stock_nombre));
}

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseProductos(wb: XLSX.WorkBook, local: LocalId): { data: VentaProducto[]; error?: string } {
  try {
    const ws = wb.Sheets['Detalle'] ?? wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const data: VentaProducto[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[3]) continue;
      const rawFecha = r[0];
      let fecha = '';
      if (rawFecha instanceof Date)        fecha = rawFecha.toISOString().slice(0, 10);
      else if (typeof rawFecha === 'number') fecha = new Date((rawFecha - 25569) * 86400 * 1000).toISOString().slice(0, 10);
      else if (typeof rawFecha === 'string') fecha = rawFecha.slice(0, 10);
      data.push({
        fecha, local,
        categoria:   String(r[1] ?? '').toUpperCase(),
        producto:    String(r[3] ?? '').toUpperCase(),
        cantidad:    Number(r[4]) || 0,
        monto_total: Number(r[5]) || 0,
      });
    }
    return { data };
  } catch (e: any) { return { data: [], error: e.message }; }
}

function parseOrdenes(wb: XLSX.WorkBook, local: LocalId): { data: VentaOrden[]; error?: string } {
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    let headerIdx = rows.findIndex(r => r.includes('Id'));
    if (headerIdx === -1) headerIdx = 2;
    const headers: string[] = rows[headerIdx].map((h: any) => String(h ?? ''));
    const col = (name: string) => headers.indexOf(name);
    const toDate = (val: any): string | null => {
      if (!val) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000).toISOString();
      if (typeof val === 'string' && val.includes('-')) return new Date(val).toISOString();
      return null;
    };
    const data: VentaOrden[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const id = Number(r[col('Id')]);
      if (!id || isNaN(id)) continue;
      const fiscalRaw = String(r[col('Fiscal')] ?? '').toLowerCase();
      data.push({
        id, local,
        fecha:      toDate(r[col('Fecha')])?.slice(0, 10) ?? null,
        creacion:   toDate(r[col('Creación')]),
        cerrada:    toDate(r[col('Cerrada')]),
        cliente:    r[col('Cliente')] ? String(r[col('Cliente')]) : null,
        medio_pago: r[col('Medio de Pago')] ? String(r[col('Medio de Pago')]) : null,
        total:      Number(r[col('Total')]) || 0,
        fiscal:     fiscalRaw === 'si' || fiscalRaw === 'sí',
        tipo_venta: r[col('Tipo de Venta')] ? String(r[col('Tipo de Venta')]) : null,
        origen:     r[col('Origen')] ? String(r[col('Origen')]) : null,
        comentario: r[col('Comentario')] ? String(r[col('Comentario')]) : null,
      });
    }
    return { data };
  } catch (e: any) { return { data: [], error: e.message }; }
}

function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { resolve(XLSX.read(e.target?.result, { type: 'binary', cellDates: true })); }
      catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('es-AR') : '—';

// Turno: mediodía 12-15, noche 20-00
function getTurno(creacion: string | null): 'mediodia' | 'noche' | null {
  if (!creacion) return null;
  const h = new Date(creacion).getHours();
  if (h >= 12 && h < 15) return 'mediodia';
  if (h >= 20 || h < 2)  return 'noche';
  return null;
}

// ─── Mini Pie Chart SVG ───────────────────────────────────────────────────────
function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-center text-slate-600 py-8">Sin datos</div>;

  let startAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const pct   = d.value / total;
    const angle = pct * 2 * Math.PI;
    const x1 = 50 + 40 * Math.cos(startAngle);
    const y1 = 50 + 40 * Math.sin(startAngle);
    startAngle += angle;
    const x2 = 50 + 40 * Math.cos(startAngle);
    const y2 = 50 + 40 * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...d, pct, path: `M50,50 L${x1},${y1} A40,40 0 ${large},1 ${x2},${y2} Z` };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#0f172a" strokeWidth="1" />)}
      </svg>
      <div className="space-y-2 flex-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-slate-300 font-bold">{s.label}</span>
            </span>
            <span className="font-black text-white">{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TabVentas() {
  const [fileProductos, setFileProductos] = useState<File | null>(null);
  const [fileOrdenes, setFileOrdenes]     = useState<File | null>(null);
  const [localSeleccionado, setLocalSeleccionado] = useState<LocalId>('burger');
  const [parsed, setParsed]       = useState<ParseResult | null>(null);
  const [parsing, setParsing]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState('');

  const [ventas, setVentas]   = useState<VentaProducto[]>([]);
  const [ordenes, setOrdenes] = useState<VentaOrden[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showUpload, setShowUpload]   = useState(false);
  const [expandTop, setExpandTop]     = useState(false);
  const [showStockPreview, setShowStockPreview] = useState(false);
  const [stockDescuentos, setStockDescuentos]   = useState<StockDescuento[]>([]);
  const [descuentoEjecutado, setDescuentoEjecutado] = useState(false);
  const [descuentoError, setDescuentoError]         = useState('');
  const [descuentando, setDescuentando]             = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'dia' | 'mes'>('dia');
  const [filtroLocalVista, setFiltroLocalVista] = useState<LocalId | 'todos'>('todos');

  const fetchVentas = async () => {
    setLoadingData(true);
    const [{ data: v }, { data: o }] = await Promise.all([
      supabase.from('ventas').select('*').order('fecha', { ascending: false }),
      supabase.from('ventas_ordenes').select('*').order('fecha', { ascending: false }),
    ]);
    setVentas((v ?? []) as VentaProducto[]);
    setOrdenes((o ?? []) as VentaOrden[]);
    setLoadingData(false);
  };

  useEffect(() => { fetchVentas(); }, []);

  // Parsear cuando ambos archivos están listos
  useEffect(() => {
    if (!fileProductos || !fileOrdenes) return;
    (async () => {
      setParsing(true); setParsed(null);
      try {
        const [wb1, wb2] = await Promise.all([readWorkbook(fileProductos), readWorkbook(fileOrdenes)]);
        const { data: prods, error: e1 } = parseProductos(wb1, localSeleccionado);
        const { data: ords,  error: e2 } = parseOrdenes(wb2, localSeleccionado);
        const allFechas = [...prods.map(p => p.fecha), ...ords.map(o => o.fecha ?? '')].filter(Boolean).sort();
        const descuentos = calcularDescuentos(prods);
        setStockDescuentos(descuentos);
        setShowStockPreview(true);
        setDescuentoEjecutado(false);
        setParsed({ productos: prods, ordenes: ords,
          fechaDesde: allFechas[0] ?? '', fechaHasta: allFechas[allFechas.length - 1] ?? '',
          errorProductos: e1, errorOrdenes: e2 });
      } catch (e: any) { setImportError('Error al leer los archivos: ' + e.message); }
      setParsing(false);
    })();
  }, [fileProductos, fileOrdenes, localSeleccionado]);

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true); setImportError('');
    try {
      if (parsed.productos.length > 0) {
        const { error } = await supabase.from('ventas').upsert(
          parsed.productos, { onConflict: 'fecha,producto,local' }
        );
        if (error) throw new Error('Productos: ' + error.message);
      }
      if (parsed.ordenes.length > 0) {
        const { error } = await supabase.from('ventas_ordenes').upsert(
          parsed.ordenes, { onConflict: 'id' }
        );
        if (error) throw new Error('Órdenes: ' + error.message);
      }
      setImportDone(true);
      await fetchVentas();
      // NO cerramos el panel - el usuario todavía necesita descontar stock
    } catch (e: any) { setImportError(e.message); }
    setImporting(false);
  };

  const handleDescuentoStock = async () => {
    if (!parsed || stockDescuentos.length === 0) return;
    setDescuentando(true); setDescuentoError('');
    try {
      let ok = 0; const errores: string[] = [];
      const fecha = parsed.fechaHasta || new Date().toISOString().slice(0, 10);

      for (const d of stockDescuentos) {
        const tabla = d.stock_tipo === 'stock' ? 'stock' : 'stock_produccion';
        const campoNombre = d.stock_tipo === 'stock' ? 'nombre' : 'producto';
        const { data, error: fetchErr } = await supabase
          .from(tabla).select('id, cantidad').eq(campoNombre, d.stock_nombre).single();
        if (fetchErr || !data) { errores.push(`${d.stock_nombre}: no encontrado`); continue; }

        // Permitir stock negativo — se cubre con próxima factura
        const newQty = parseFloat(((data.cantidad as number) - d.cantidad_total).toFixed(3));
        const updateData: any = { cantidad: parseFloat(newQty.toFixed(3)) };
        if (d.stock_tipo === 'stock') updateData.fecha_actualizacion = fecha;
        const { error: updateErr } = await supabase.from(tabla)
          .update(updateData)
          .eq('id', data.id);
        if (updateErr) { errores.push(`${d.stock_nombre}: ${updateErr.message}`); continue; }

        // Notificar si stock baja de umbral
        if (d.stock_tipo === 'stock') {
          await checkAndNotifyStock(d.stock_nombre, newQty, d.unidad, data as any);
          await supabase.from('stock_movements').insert({
            nombre: d.stock_nombre, categoria: d.stock_cat ?? '',
            tipo: 'egreso', cantidad: parseFloat(d.cantidad_total.toFixed(3)),
            unidad: d.unidad, motivo: 'Descuento por ventas Fudo',
            operador: 'Sistema', fecha: new Date().toISOString(),
          });
        }
        ok++;
      }
      if (errores.length > 0) setDescuentoError(errores.join(' | '));
      setDescuentoEjecutado(true);
    } catch (e: any) { setDescuentoError(e.message); }
    setDescuentando(false);
  };

  const onDrop = useCallback((e: React.DragEvent, type: 'productos' | 'ordenes') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (type === 'productos') setFileProductos(file);
    else setFileOrdenes(file);
  }, []);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const hoy = new Date().toISOString().slice(0, 10);

  // Filtro de período (día actual vs histórico mes)
  const ventasFiltradas  = filtroPeriodo === 'dia' ? ventas.filter(v => v.fecha === hoy)  : ventas;
  const ordenesFiltradas = filtroPeriodo === 'dia' ? ordenes.filter(o => o.fecha === hoy) : ordenes;

  // Filtro de local para la vista general
  const ventasVista  = filtroLocalVista === 'todos' ? ventasFiltradas  : ventasFiltradas.filter(v => v.local === filtroLocalVista);
  const ordenesVista = filtroLocalVista === 'todos' ? ordenesFiltradas : ordenesFiltradas.filter(o => o.local === filtroLocalVista);

  // KPIs generales
  const ordenesConTotal = ordenesVista.filter(o => o.total > 0);
  const totalFacturado  = ordenesConTotal.reduce((s, o) => s + o.total, 0);
  const totalOrdenes    = ordenesConTotal.length;
  const ticketPromedio  = totalOrdenes > 0 ? totalFacturado / totalOrdenes : 0;

  // Por local — para cards y pie
  const statsPorLocal = LOCALES.map(loc => {
    const ords = ordenesFiltradas.filter(o => o.local === loc.id && o.total > 0);
    const vents = ventasFiltradas.filter(v => v.local === loc.id);
    const facturacion = ords.reduce((s, o) => s + o.total, 0);
    const mediodia = ords.filter(o => getTurno(o.creacion) === 'mediodia').reduce((s, o) => s + o.total, 0);
    const noche    = ords.filter(o => getTurno(o.creacion) === 'noche').reduce((s, o) => s + o.total, 0);
    const delivery  = ords.filter(o => o.tipo_venta === 'Delivery').length;
    const mostrador = ords.filter(o => o.tipo_venta === 'Mostrador').length;
    return { ...loc, facturacion, ordenes: ords.length, mediodia, noche, delivery, mostrador, vents };
  });
  const totalFact = statsPorLocal.reduce((s, l) => s + l.facturacion, 0);

  // Pie chart data
  const pieData = statsPorLocal
    .filter(l => l.facturacion > 0)
    .map(l => ({ label: l.label, value: l.facturacion, color: l.hex }));

  // Facturación por fecha (para gráfico)
  const porFecha: Record<string, number> = {};
  ordenesFiltradas.filter(o => o.total > 0).forEach(o => {
    if (!o.fecha) return;
    porFecha[o.fecha] = (porFecha[o.fecha] ?? 0) + o.total;
  });
  const fechasOrdenadas = Object.entries(porFecha).sort((a, b) => a[0].localeCompare(b[0]));
  const maxVenta = Math.max(...fechasOrdenadas.map(([, v]) => v), 1);

  // Facturación por fecha POR LOCAL (para gráfico stacked)
  const porFechaLocal: Record<string, Record<LocalId, number>> = {};
  ordenesFiltradas.filter(o => o.total > 0).forEach(o => {
    if (!o.fecha) return;
    if (!porFechaLocal[o.fecha]) porFechaLocal[o.fecha] = { burger: 0, lomito: 0, milanesa: 0 };
    porFechaLocal[o.fecha][o.local] = (porFechaLocal[o.fecha][o.local] ?? 0) + o.total;
  });

  // Top productos (filtrado)
  const porProducto: Record<string, { qty: number; monto: number; cat: string }> = {};
  ventasVista.forEach(v => {
    if (!porProducto[v.producto]) porProducto[v.producto] = { qty: 0, monto: 0, cat: v.categoria };
    porProducto[v.producto].qty   += v.cantidad;
    porProducto[v.producto].monto += v.monto_total;
  });
  const topProductos = Object.entries(porProducto).sort((a, b) => b[1].qty - a[1].qty).slice(0, expandTop ? 20 : 8);

  // Por categoría (filtrado)
  const porCategoria: Record<string, { qty: number; monto: number }> = {};
  ventasVista.forEach(v => {
    if (!porCategoria[v.categoria]) porCategoria[v.categoria] = { qty: 0, monto: 0 };
    porCategoria[v.categoria].qty   += v.cantidad;
    porCategoria[v.categoria].monto += v.monto_total;
  });
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1].monto - a[1].monto);

  // Medios de pago
  const mercadoPago = ordenesVista.filter(o => o.medio_pago?.toLowerCase().includes('mercado') && o.total > 0).length;
  const efectivo    = ordenesVista.filter(o => o.medio_pago?.toLowerCase().includes('efectivo') && o.total > 0).length;
  const delivery    = ordenesVista.filter(o => o.tipo_venta === 'Delivery' && o.total > 0).length;
  const mostrador   = ordenesVista.filter(o => o.tipo_venta === 'Mostrador' && o.total > 0).length;

  const hayDatos = ventas.length > 0;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-xl">Ventas</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {hayDatos
              ? `${ventas.length} productos · ${ordenes.length} órdenes · 3 locales`
              : 'Sin datos aún — cargá un reporte para comenzar'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {importDone && <span className="flex items-center gap-1 text-green-400 text-sm font-bold"><CheckCircle2 size={16} /> Importado</span>}
          <button onClick={fetchVentas} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw size={16} className={`text-slate-400 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowUpload(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 font-black text-sm rounded-xl hover:bg-slate-100 transition-colors">
            <Upload size={16} /> Cargar reporte
          </button>
        </div>
      </div>

      {/* ── PANEL UPLOAD ── */}
      {showUpload && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="font-black text-white flex items-center gap-2"><Upload size={18} /> Importar reporte</h3>

          {/* Selector de local */}
          <div>
            <p className="text-xs text-slate-400 font-black uppercase mb-2">¿De qué local es este reporte?</p>
            <div className="flex gap-2">
              {LOCALES.map(loc => (
                <button key={loc.id} onClick={() => setLocalSeleccionado(loc.id)}
                  className={`flex-1 py-3 rounded-xl font-black text-sm transition-all border-2
                    ${localSeleccionado === loc.id
                      ? `${loc.bg} ${loc.border} ${loc.color}`
                      : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reporte-Productos */}
            <div onDrop={e => onDrop(e, 'productos')} onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                ${fileProductos ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-slate-400'}`}
              onClick={() => document.getElementById('file-productos')?.click()}>
              <input id="file-productos" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => setFileProductos(e.target.files?.[0] ?? null)} />
              {fileProductos
                ? <div className="flex items-center justify-center gap-2 text-green-400"><CheckCircle2 size={20} /><span className="font-bold text-sm">{fileProductos.name}</span></div>
                : <><ShoppingBag size={32} className="text-slate-500 mx-auto mb-2" /><p className="font-bold text-slate-300 text-sm">Reporte-Productos.xlsx</p><p className="text-slate-500 text-xs mt-1">Arrastrá o hacé click</p></>}
            </div>

            {/* ventas.xls */}
            <div onDrop={e => onDrop(e, 'ordenes')} onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                ${fileOrdenes ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-slate-400'}`}
              onClick={() => document.getElementById('file-ordenes')?.click()}>
              <input id="file-ordenes" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => setFileOrdenes(e.target.files?.[0] ?? null)} />
              {fileOrdenes
                ? <div className="flex items-center justify-center gap-2 text-green-400"><CheckCircle2 size={20} /><span className="font-bold text-sm">{fileOrdenes.name}</span></div>
                : <><BarChart3 size={32} className="text-slate-500 mx-auto mb-2" /><p className="font-bold text-slate-300 text-sm">ventas.xls</p><p className="text-slate-500 text-xs mt-1">Arrastrá o hacé click</p></>}
            </div>
          </div>

          {parsing && <div className="flex items-center gap-3 text-slate-400 text-sm"><RefreshCw size={16} className="animate-spin" /> Leyendo archivos...</div>}

          {parsed && !parsing && (
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-slate-400 uppercase">Preview —</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${LOCALES.find(l => l.id === localSeleccionado)?.bg} ${LOCALES.find(l => l.id === localSeleccionado)?.color}`}>
                    {LOCALES.find(l => l.id === localSeleccionado)?.label}
                  </span>
                </div>
                {parsed.errorProductos && <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={14} /> {parsed.errorProductos}</p>}
                {parsed.errorOrdenes   && <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={14} /> {parsed.errorOrdenes}</p>}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-700 rounded-xl p-3"><p className="text-2xl font-black text-white">{parsed.productos.length}</p><p className="text-xs text-slate-400">productos</p></div>
                  <div className="bg-slate-700 rounded-xl p-3"><p className="text-2xl font-black text-white">{parsed.ordenes.length}</p><p className="text-xs text-slate-400">órdenes</p></div>
                  <div className="bg-slate-700 rounded-xl p-3"><p className="text-lg font-black text-green-400">{fmt$(parsed.ordenes.filter(o => o.total > 0).reduce((s, o) => s + o.total, 0))}</p><p className="text-xs text-slate-400">facturado</p></div>
                  <div className="bg-slate-700 rounded-xl p-3"><p className="text-sm font-black text-slate-300">{fmtDate(parsed.fechaDesde)}</p><p className="text-xs text-slate-400">período</p></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2 font-bold uppercase">Top 5</p>
                  {[...parsed.productos].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5).map((p, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-slate-700 last:border-0">
                      <span className="text-sm text-slate-300 font-bold">{p.producto}</span>
                      <div className="flex gap-4"><span className="text-xs text-slate-400">{p.cantidad} u</span><span className="text-xs font-black text-green-400">{fmt$(p.monto_total)}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              {importError && <p className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle size={16} /> {importError}</p>}
              <div className="flex gap-3">
                {importDone ? (
                  <div className="flex-1 flex items-center gap-2 py-3 bg-green-500/20 border border-green-500/40 rounded-xl text-green-400 font-black text-sm justify-center">
                    <CheckCircle2 size={16} /> Ventas guardadas ✓
                  </div>
                ) : (
                  <button onClick={handleImport} disabled={importing}
                    className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {importing ? <><RefreshCw size={16} className="animate-spin" /> Importando...</> : <><CheckCircle2 size={16} /> Paso 1: Guardar ventas</>}
                  </button>
                )}
                <button onClick={() => { setFileProductos(null); setFileOrdenes(null); setParsed(null); setShowUpload(false); setImportDone(false); setDescuentoEjecutado(false); setStockDescuentos([]); }}
                  className="px-4 py-3 bg-slate-700 text-slate-300 font-bold rounded-xl hover:bg-slate-600 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* ── Preview descuento de stock ── */}
              {stockDescuentos.length > 0 && (
                <div className="border border-slate-600 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowStockPreview(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 hover:bg-slate-700 transition-colors text-left">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-amber-400" />
                      <span className="text-sm font-black text-white">Descuento de stock</span>
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                        {stockDescuentos.length} items
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{showStockPreview ? '▲ ocultar' : '▼ ver detalle'}</span>
                  </button>

                  {showStockPreview && (
                    <div className="p-4 space-y-4">
                      <p className="text-xs text-slate-400">
                        Basado en las ventas del reporte y las recetas cargadas.
                        Revisá antes de confirmar.
                      </p>

                      {/* Stock directo */}
                      {stockDescuentos.filter(d => d.stock_tipo === 'stock').length > 0 && (
                        <div>
                          <p className="text-xs font-black text-slate-400 uppercase mb-2">📦 Stock de materias primas</p>
                          <div className="space-y-1">
                            {stockDescuentos.filter(d => d.stock_tipo === 'stock').map(d => (
                              <div key={d.stock_nombre} className="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
                                <div>
                                  <span className="text-sm font-bold text-white">{d.stock_nombre}</span>
                                  <span className="text-xs text-slate-500 ml-2">({d.stock_cat})</span>
                                </div>
                                <span className="text-sm font-black text-red-400">
                                  - {d.cantidad_total.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')} {d.unidad}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stock de producción */}
                      {stockDescuentos.filter(d => d.stock_tipo === 'stock_produccion').length > 0 && (
                        <div>
                          <p className="text-xs font-black text-slate-400 uppercase mb-2">🏭 Stock de producción</p>
                          <div className="space-y-1">
                            {stockDescuentos.filter(d => d.stock_tipo === 'stock_produccion').map(d => (
                              <div key={d.stock_nombre} className="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
                                <span className="text-sm font-bold text-white">{d.stock_nombre}</span>
                                <span className="text-sm font-black text-red-400">
                                  - {d.cantidad_total.toFixed(1)} {d.unidad}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {descuentoError && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertTriangle size={12} /> {descuentoError}
                        </p>
                      )}

                      {descuentoEjecutado ? (
                        <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                          <CheckCircle2 size={16} /> Stock descontado correctamente
                        </div>
                      ) : (
                        <button
                          onClick={handleDescuentoStock}
                          disabled={descuentando || !importDone}
                          className={`w-full py-2.5 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50
                            ${!importDone ? 'bg-slate-700 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500'}`}>
                          {descuentando
                            ? <><RefreshCw size={14} className="animate-spin" /> Descontando...</>
                            : !importDone
                              ? <><Package size={14} /> Primero guardá las ventas (Paso 1)</>
                              : <><Package size={14} /> Paso 2: Confirmar descuento de stock</>}
                        </button>
                      )}
                      {descuentoEjecutado && (
                        <button
                          onClick={() => { setFileProductos(null); setFileOrdenes(null); setParsed(null); setShowUpload(false); setImportDone(false); setDescuentoEjecutado(false); setStockDescuentos([]); }}
                          className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm rounded-xl transition-colors">
                          ✓ Listo — Cerrar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sin datos */}
      {!loadingData && !hayDatos && (
        <div className="text-center py-24 text-slate-600">
          <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-black text-lg">Sin datos de ventas</p>
          <p className="text-sm mt-1">Cargá los reportes de cada local con el botón de arriba</p>
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {hayDatos && (
        <>
          {/* Filtros globales */}
          <div className="flex items-center justify-between">
            {/* Período */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
              {([['dia', 'Hoy'], ['mes', 'Histórico']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setFiltroPeriodo(id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${filtroPeriodo === id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            {/* Filtro local */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
              <button onClick={() => setFiltroLocalVista('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroLocalVista === 'todos' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                Todos
              </button>
              {LOCALES.map(loc => (
                <button key={loc.id} onClick={() => setFiltroLocalVista(loc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${filtroLocalVista === loc.id ? `${loc.bg} ${loc.color}` : 'text-slate-400 hover:text-white'}`}>
                  {loc.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* KPIs generales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total facturado',  value: fmt$(totalFacturado),           color: 'text-green-400',  bg: 'bg-green-500/10',  icon: <TrendingUp size={20} /> },
              { label: 'Órdenes',          value: totalOrdenes,                   color: 'text-blue-400',   bg: 'bg-blue-500/10',   icon: <ShoppingBag size={20} /> },
              { label: 'Ticket promedio',  value: fmt$(Math.round(ticketPromedio)),color: 'text-amber-400',  bg: 'bg-amber-500/10',  icon: <BarChart3 size={20} /> },
              { label: 'Productos únicos', value: Object.keys(porProducto).length, color: 'text-purple-400', bg: 'bg-purple-500/10', icon: <Package size={20} /> },
            ].map((k, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center mb-3 ${k.color}`}>{k.icon}</div>
                <p className={`text-2xl font-black ${k.color} mb-1`}>{k.value}</p>
                <p className="text-slate-400 text-xs font-medium">{k.label}</p>
              </div>
            ))}
          </div>

          {/* ── CARDS POR LOCAL con turnos ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statsPorLocal.map(loc => (
              <div key={loc.id} className={`bg-slate-900 border-2 ${loc.border} rounded-2xl p-5 space-y-4`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-black text-sm ${loc.color}`}>{loc.label}</h3>
                  <span className="text-xs text-slate-500">{loc.ordenes} órdenes</span>
                </div>
                <div>
                  <p className={`text-3xl font-black ${loc.color}`}>{fmt$(loc.facturacion)}</p>
                  {totalFact > 0 && (
                    <div className="mt-2 bg-slate-800 rounded-full h-1.5">
                      <div className={`${loc.bar} h-1.5 rounded-full`} style={{ width: `${(loc.facturacion / totalFact) * 100}%` }} />
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{totalFact > 0 ? Math.round((loc.facturacion / totalFact) * 100) : 0}% del total</p>
                </div>
                {/* Turnos */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">☀️ Mediodía</p>
                    <p className={`text-sm font-black ${loc.color}`}>{fmt$(loc.mediodia)}</p>
                    <p className="text-[10px] text-slate-600">12hs – 15hs</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">🌙 Noche</p>
                    <p className={`text-sm font-black ${loc.color}`}>{fmt$(loc.noche)}</p>
                    <p className="text-[10px] text-slate-600">20hs – 00hs</p>
                  </div>
                </div>
                {/* Delivery/Mostrador mini */}
                <div className="flex gap-3 text-xs text-slate-400">
                  <span>🛵 {loc.delivery} delivery</span>
                  <span>🏪 {loc.mostrador} mostrador</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Gráfico de torta + barra por día ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Pie */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black text-slate-400 uppercase">Participación por local</p>
                <span className="text-xs text-slate-600">{filtroPeriodo === 'dia' ? 'Hoy' : 'Histórico'}</span>
              </div>
              <PieChart data={pieData} />
              <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
                {statsPorLocal.map(loc => (
                  <div key={loc.id}>
                    <p className={`text-xs font-black ${loc.color}`}>{fmt$(loc.facturacion)}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{loc.label.split(' ')[0]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Barra por día */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Facturación por día</p>
              {fechasOrdenadas.length === 0
                ? <div className="text-center py-8 text-slate-600 text-sm">Sin datos para el período</div>
                : (
                  <div className="flex items-end gap-2 h-32">
                    {fechasOrdenadas.map(([fecha]) => {
                      const locData = porFechaLocal[fecha] ?? { burger: 0, lomito: 0, milanesa: 0 };
                      const total   = LOCALES.reduce((s, l) => s + (locData[l.id] ?? 0), 0);
                      return (
                        <div key={fecha} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                            {fmt$(total)}
                          </div>
                          {/* Stacked bar */}
                          <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${Math.max(4, (total / maxVenta) * 120)}px` }}>
                            {LOCALES.map(loc => {
                              const h = total > 0 ? ((locData[loc.id] ?? 0) / total) * 100 : 0;
                              return h > 0 ? <div key={loc.id} className={`w-full ${loc.bar}`} style={{ height: `${h}%` }} /> : null;
                            })}
                          </div>
                          <span className="text-[9px] text-slate-500 whitespace-nowrap">
                            {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              {/* Leyenda */}
              <div className="flex gap-4 mt-3 justify-center">
                {LOCALES.map(loc => (
                  <span key={loc.id} className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${loc.bar}`} /> {loc.label.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Delivery/Mostrador + Medios de pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Tipo de venta</p>
              <div className="space-y-3">
                {[{ label: 'Delivery', value: delivery, icon: <Truck size={16} />, color: 'text-blue-400', bar: 'bg-blue-500' },
                  { label: 'Mostrador', value: mostrador, icon: <ShoppingBag size={16} />, color: 'text-amber-400', bar: 'bg-amber-500' }].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`flex items-center gap-2 text-sm font-bold ${item.color}`}>{item.icon} {item.label}</span>
                      <span className="text-white font-black">{item.value} <span className="text-slate-500 text-xs">({totalOrdenes > 0 ? Math.round((item.value / totalOrdenes) * 100) : 0}%)</span></span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-2">
                      <div className={`${item.bar} h-2 rounded-full`} style={{ width: `${totalOrdenes > 0 ? (item.value / totalOrdenes) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Medio de pago</p>
              <div className="space-y-3">
                {[{ label: 'Mercado Pago', value: mercadoPago, icon: <CreditCard size={16} />, color: 'text-blue-400', bar: 'bg-blue-500' },
                  { label: 'Efectivo',     value: efectivo,    icon: <Banknote size={16} />,   color: 'text-green-400', bar: 'bg-green-500' }].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`flex items-center gap-2 text-sm font-bold ${item.color}`}>{item.icon} {item.label}</span>
                      <span className="text-white font-black">{item.value} <span className="text-slate-500 text-xs">({totalOrdenes > 0 ? Math.round((item.value / totalOrdenes) * 100) : 0}%)</span></span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-2">
                      <div className={`${item.bar} h-2 rounded-full`} style={{ width: `${totalOrdenes > 0 ? (item.value / totalOrdenes) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Por categoría */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800"><h3 className="font-bold text-white">Ventas por categoría</h3></div>
            <div className="divide-y divide-slate-800">
              {categoriasOrdenadas.map(([cat, stats]) => (
                <div key={cat} className="px-6 py-4">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-slate-200 text-sm">{cat}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-400">{stats.qty} u</span>
                      <span className="text-sm font-black text-green-400">{fmt$(stats.monto)}</span>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(stats.monto / (categoriasOrdenadas[0]?.[1]?.monto || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top productos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Top productos vendidos</h3>
              <button onClick={() => setExpandTop(v => !v)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                {expandTop ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver todos</>}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">#</th>
                  <th className="px-6 py-3 text-left">Producto</th>
                  <th className="px-6 py-3 text-left">Categoría</th>
                  <th className="px-6 py-3 text-right">Unidades</th>
                  <th className="px-6 py-3 text-right">Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {topProductos.map(([producto, stats], i) => (
                  <tr key={producto} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3 text-slate-600 font-black text-xs">{i + 1}</td>
                    <td className="px-6 py-3 font-bold text-white">{producto}</td>
                    <td className="px-6 py-3 text-slate-400 text-xs">{stats.cat}</td>
                    <td className="px-6 py-3 text-right font-black text-blue-400">{stats.qty}</td>
                    <td className="px-6 py-3 text-right font-black text-green-400">{fmt$(stats.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}