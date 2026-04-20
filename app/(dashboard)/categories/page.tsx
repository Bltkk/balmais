'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types/database';

const PALETTE = [
  { label: 'Gris',    value: '#6b7280' },
  { label: 'Rojo',    value: '#ef4444' },
  { label: 'Naranja', value: '#f97316' },
  { label: 'Ámbar',   value: '#f59e0b' },
  { label: 'Verde',   value: '#22c55e' },
  { label: 'Teal',    value: '#14b8a6' },
  { label: 'Azul',    value: '#3b82f6' },
  { label: 'Índigo',  value: '#6366f1' },
  { label: 'Violeta', value: '#8b5cf6' },
  { label: 'Rosa',    value: '#ec4899' },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0].value);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    setCategories(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const { error: err } = await supabase.from('categories').insert({ name, color: newColor, user_id: user.id });
    if (err) {
      setError(err.code === '23505' ? 'Ya existe una categoría con ese nombre' : err.message);
    } else {
      setNewName('');
      setNewColor(PALETTE[0].value);
      load();
    }
    setCreating(false);
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
    setError('');
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const { error: err } = await supabase
      .from('categories')
      .update({ name, color: editColor })
      .eq('id', id);
    if (err) {
      setError(err.code === '23505' ? 'Ya existe una categoría con ese nombre' : err.message);
    } else {
      setEditingId(null);
      load();
    }
  };

  const handleDelete = async (cat: Category) => {
    // Check how many products use this category
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', cat.id);

    const msg = count && count > 0
      ? `La categoría "${cat.name}" está asignada a ${count} producto${count > 1 ? 's' : ''}. ¿Eliminarla? Los productos quedarán sin categoría.`
      : `¿Eliminar la categoría "${cat.name}"?`;

    if (!confirm(msg)) return;
    const { error: err } = await supabase.from('categories').delete().eq('id', cat.id);
    if (err) setError(err.message);
    else load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
        <p className="text-gray-500 mt-1">Organiza tus productos por tipo de prenda</p>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Nueva categoría</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. Poleras, Jeans, Outerwear…"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            required
          />
          <div className="flex gap-2 items-center">
            {PALETTE.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.label}
                onClick={() => setNewColor(p.value)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  newColor === p.value ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: p.value }}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            {creating ? 'Creando…' : 'Crear'}
          </button>
        </form>
      </div>

      {/* Category list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <p className="text-gray-500">Aún no hay categorías. Crea la primera arriba.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center gap-4 px-6 py-4">
                {editingId === cat.id ? (
                  <>
                    <div className="flex gap-1.5 items-center flex-shrink-0">
                      {PALETTE.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          title={p.label}
                          onClick={() => setEditColor(p.value)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            editColor === p.value ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: p.value }}
                        />
                      ))}
                    </div>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(cat.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(cat.id)}
                        className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-gray-900">{cat.name}</span>
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEdit(cat)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
