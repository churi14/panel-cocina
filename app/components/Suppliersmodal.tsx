"use client";
import React, { useState, useEffect } from 'react';
import { 
  Beef, Truck, BookOpen, Droplet, LogOut, Scale,
  UtensilsCrossed, ChevronRight, PackageMinus, X, Carrot, Wine, Sandwich, Wheat, Soup,
  Plus, Trash2, Calculator, CheckCircle2, Clock, AlertCircle, ArrowLeft, Play, Square, CheckSquare,
  Search, Phone, MapPin, Mail, Calendar as CalendarIcon, FileText, User, Edit, List, BarChart3, Download
} from 'lucide-react';
import type { Ingredient, Recipe, ProductionRecord, Supplier } from '../types';

export default function SuppliersModal({ onClose, suppliersDB, setSuppliersDB }: any) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const emptyForm = { name: "", categories: [] as string[], cuit: "", phone: "", email: "", address: "", days: [] as string[] };
    const [formData, setFormData] = useState(emptyForm);
    const categoriesList = ["Carnicería", "Panificados", "Insumos", "Verduras", "Fiambres", "Aderezos", "Bebidas"];
    const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    const handleSelect = (s: any) => { setSelectedId(s.id); setFormData(s); setIsEditing(false); };
    const handleNew = () => { setSelectedId(null); setFormData(emptyForm); setIsEditing(true); };
    const handleSave = () => {
        if (!formData.name) return alert("Nombre obligatorio");
        if (selectedId) setSuppliersDB(suppliersDB.map((s:any) => s.id === selectedId ? { ...formData, id: selectedId } : s));
        else setSuppliersDB([...suppliersDB, { ...formData, id: Date.now() }]);
        setIsEditing(false); setSelectedId(null);
    };
    const handleDelete = () => { if (confirm("¿Borrar?")) { setSuppliersDB(suppliersDB.filter((s:any) => s.id !== selectedId)); setSelectedId(null); setIsEditing(false); } };
    const toggleCategory = (cat: string) => { if (formData.categories.includes(cat)) setFormData({ ...formData, categories: formData.categories.filter(c => c !== cat) }); else setFormData({ ...formData, categories: [...formData.categories, cat] }); };
    const toggleDay = (day: string) => { if (formData.days.includes(day)) setFormData({ ...formData, days: formData.days.filter(d => d !== day) }); else setFormData({ ...formData, days: [...formData.days, day] }); };
    const filtered = suppliersDB.filter((s:any) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white"><div><h2 className="text-xl font-bold flex gap-2 text-slate-800 items-center"><Truck className="text-blue-600"/> Gestión de Proveedores</h2><p className="text-xs text-slate-400">Base de datos de contacto y logística</p></div><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400"/></button></div>
                <div className="flex flex-1 overflow-hidden bg-slate-50">
                    <div className="w-1/3 border-r border-slate-200 flex flex-col bg-white">
                        <div className="p-4 border-b border-slate-100"><div className="relative mb-3"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div><button onClick={handleNew} className="w-full py-2 flex items-center justify-center gap-2 text-white font-bold bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm"><Plus size={16} /> AGREGAR NUEVO</button></div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">{filtered.map((s:any) => (<div key={s.id} onClick={() => handleSelect(s)} className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedId === s.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white hover:bg-slate-50 border-slate-100'}`}><div className="flex justify-between items-start mb-2"><h3 className="font-bold text-sm">{s.name}</h3>{selectedId !== s.id && <ChevronRight size={16} className="text-slate-300"/>}</div><div className="flex flex-wrap gap-1">{s.categories.map((c:string) => <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${selectedId === s.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{c}</span>)}</div></div>))}</div>
                    </div>
                    <div className="w-2/3 p-8 overflow-y-auto">
                        {(isEditing || selectedId) ? (<div className="max-w-2xl mx-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-slate-800">{isEditing ? (selectedId ? "Editar Proveedor" : "Nuevo Proveedor") : formData.name}</h3>{!isEditing && (<div className="flex gap-2"><button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">Editar</button><button onClick={handleDelete} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100"><Trash2 size={18}/></button></div>)}</div><div className="space-y-6"><div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><label className="block text-xs font-bold text-slate-400 uppercase mb-3">Categorías</label><div className="flex flex-wrap gap-2">{categoriesList.map(cat => (<button key={cat} onClick={() => isEditing && toggleCategory(cat)} disabled={!isEditing} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.categories.includes(cat) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-400 border-slate-200'} ${isEditing ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'}`}>{cat}</button>))}</div></div><div className="grid grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre</label><input disabled={!isEditing} type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-800 disabled:bg-slate-50"/></div><div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">CUIT</label><input disabled={!isEditing} type="text" value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-slate-600 disabled:bg-slate-50"/></div></div><div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"><h4 className="font-bold text-slate-700 text-sm flex items-center gap-2"><User size={16}/> Contacto</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Teléfono</label><div className="flex gap-2"><input disabled={!isEditing} type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"/>{!isEditing && formData.phone && (<button onClick={() => window.open(`https://wa.me/${formData.phone.replace(/[^0-9]/g, '')}`, '_blank')} className="p-3 bg-green-500 text-white rounded-lg hover:bg-green-600" title="Abrir WhatsApp"><Phone size={18}/></button>)}</div></div><div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label><input disabled={!isEditing} type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"/></div><div className="col-span-2"><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Dirección</label><input disabled={!isEditing} type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"/></div></div></div><div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3"><CalendarIcon size={16}/> Días de Entrega</h4><div className="flex gap-2 justify-between">{weekDays.map(day => (<button key={day} disabled={!isEditing} onClick={() => toggleDay(day)} className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs transition-all border ${formData.days.includes(day) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{day}</button>))}</div></div>{isEditing && (<div className="flex gap-4 pt-4 border-t border-slate-200"><button onClick={() => { setIsEditing(false); if(!selectedId) setFormData(emptyForm); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button><button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 shadow-lg">GUARDAR</button></div>)}</div></div>) : (<div className="h-full flex flex-col items-center justify-center text-slate-300"><Truck size={64} className="mb-4 opacity-50"/><p className="font-bold text-lg">Selecciona un proveedor</p></div>)}
                    </div>
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------