'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types/database';

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

interface SizeRow {
  size: string;
  stock: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    price: '',
    cost: '',
    comision: '',
    category_id: '',
  });
  const [sizes, setSizes] = useState<SizeRow[]>([
    { size: 'S', stock: '0' },
    { size: 'M', stock: '0' },
    { size: 'L', stock: '0' },
  ]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('categories').select('*').eq('user_id', user.id).order('name')
        .then(({ data }) => setCategories(data || []));
    });
  }, []);

  const addSize = () => setSizes([...sizes, { size: '', stock: '0' }]);
  const removeSize = (idx: number) => setSizes(sizes.filter((_, i) => i !== idx));
  const updateSize = (idx: number, field: keyof SizeRow, value: string) =>
    setSizes(sizes.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanedSizes = sizes
      .map((s) => ({ size: s.size.trim().toUpperCase(), stock: parseInt(s.stock || '0', 10) }))
      .filter((s) => s.size.length > 0);

    if (cleanedSizes.length === 0) { setError('Agrega al menos una talla'); setLoading(false); return; }
    if (new Set(cleanedSizes.map((s) => s.size)).size !== cleanedSizes.length) { setError('Hay tallas duplicadas'); setLoading(false); return; }
    if (cleanedSizes.some((s) => isNaN(s.stock) || s.stock < 0)) { setError('El stock inicial debe ser >= 0'); setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Sesión no válida.'); setLoading(false); return; }

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert({
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost || '0') || 0,
        comision: parseInt(formData.comision || '0') || 0,
        user_id: user.id,
        category_id: formData.category_id || null,
      })
      .select()
      .single();

    if (insertError || !product) {
      if (insertError?.code === '23505') setError('El código del producto ya existe');
      else setError(insertError?.message || 'Error al crear el producto');
      setLoading(false);
      return;
    }

    const { data: insertedVariants, error: variantsError } = await supabase
      .from('product_variants')
      .insert(cleanedSizes.map((s) => ({ product_id: product.id, size: s.size, current_stock: 0 })))
      .select();

    if (variantsError || !insertedVariants) {
      await supabase.from('products').delete().eq('id', product.id);
      setError(`Error al crear tallas: ${variantsError?.message}`);
      setLoading(false);
      return;
    }

    for (const variant of insertedVariants) {
      const sizeRow = cleanedSizes.find((s) => s.size === variant.size);
      if (sizeRow && sizeRow.stock > 0) {
        const { error: rpcErr } = await supabase.rpc('register_stock_movement', {
          p_variant_id: variant.id,
          p_type: 'in',
          p_quantity: sizeRow.stock,
          p_notes: 'Stock inicial',
        });
        if (rpcErr) {
          setError(`Error al registrar stock de talla ${variant.size}: ${rpcErr.message}`);
          setLoading(false);
          return;
        }
      }
    }

    router.push('/products');
  };

  const selectedCategory = categories.find((c) => c.id === formData.category_id);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/products" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Productos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Producto</h1>
        <p className="text-gray-500 mt-1">Define el producto y su stock por talla</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Código *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="PROD-001"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Solo letras, números y guiones</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Precio de venta *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number" step="1" min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Costo</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number" step="1" min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Precio al que comprás el producto</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Comisión vendedor</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number" step="100" min="0"
                  value={formData.comision}
                  onChange={(e) => setFormData({ ...formData, comision: e.target.value })}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Por unidad vendida (ej. $1.000 o $2.000)</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              placeholder="Polera básica azul"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
            <div className="flex gap-2 items-center">
              {selectedCategory && (
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedCategory.color }}
                />
              )}
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {categories.length === 0 && (
                <Link href="/categories" className="text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap">
                  Crear categorías →
                </Link>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              placeholder="Descripción opcional"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Tallas y stock inicial *</label>
              <button type="button" onClick={addSize} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                + Agregar talla
              </button>
            </div>
            <div className="space-y-2">
              {sizes.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <input
                    list="common-sizes"
                    type="text"
                    value={row.size}
                    onChange={(e) => updateSize(idx, 'size', e.target.value)}
                    placeholder="Talla (ej. M, 40, Único)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 uppercase"
                  />
                  <input
                    type="number" min="0"
                    value={row.stock}
                    onChange={(e) => updateSize(idx, 'stock', e.target.value)}
                    placeholder="Stock"
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeSize(idx)}
                    disabled={sizes.length === 1}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                  >✕</button>
                </div>
              ))}
            </div>
            <datalist id="common-sizes">
              {COMMON_SIZES.map((s) => <option key={s} value={s} />)}
            </datalist>
            <p className="text-xs text-gray-500 mt-2">
              Cada talla tendrá su stock independiente. Podrás sumar o restar stock después.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Creando…' : 'Crear Producto'}
            </button>
            <Link
              href="/products"
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
