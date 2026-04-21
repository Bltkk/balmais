'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Category, Product, ProductVariant } from '@/types/database';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    price: '',
    category_id: '',
    status: 'active' as 'active' | 'discontinued',
    low_stock_threshold: '5',
  });
  const [newSize, setNewSize] = useState('');
  const [newStock, setNewStock] = useState('0');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: cats } = await supabase
        .from('categories').select('*').eq('user_id', user.id).order('name');
      setCategories(cats || []);
    }

    const { data, error: loadErr } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', id)
      .single();

    if (loadErr || !data) { setError('Producto no encontrado'); setLoading(false); return; }

    setProduct(data as Product);
    setVariants(((data as any).variants as ProductVariant[]) || []);
    setFormData({
      code: data.code,
      name: data.name,
      description: data.description || '',
      price: data.price.toString(),
      category_id: data.category_id || '',
      status: data.status || 'active',
      low_stock_threshold: String(data.low_stock_threshold ?? 5),
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSaving(true);
    setError('');

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) { setError('El precio debe ser mayor a 0'); setSaving(false); return; }

    const threshold = parseInt(formData.low_stock_threshold, 10);
    if (isNaN(threshold) || threshold < 0) { setError('El umbral de stock bajo debe ser >= 0'); setSaving(false); return; }

    const { error: updateErr } = await supabase
      .from('products')
      .update({
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        price,
        category_id: formData.category_id || null,
        status: formData.status,
        low_stock_threshold: threshold,
      })
      .eq('id', product.id);

    if (updateErr) {
      if (updateErr.code === '23505') setError('El código del producto ya existe');
      else setError(updateErr.message);
      setSaving(false);
      return;
    }
    router.push('/products');
  };

  const addVariant = async () => {
    if (!product) return;
    setError('');
    const size = newSize.trim().toUpperCase();
    const stock = parseInt(newStock || '0', 10);
    if (!size) { setError('Ingresa el nombre de la talla'); return; }
    if (isNaN(stock) || stock < 0) { setError('El stock inicial debe ser >= 0'); return; }
    if (variants.some((v) => v.size === size)) { setError(`Ya existe la talla "${size}"`); return; }

    const { error: insertErr } = await supabase.from('product_variants').insert({
      product_id: product.id, size, current_stock: stock,
    });
    if (insertErr) { setError(insertErr.message); return; }
    setNewSize(''); setNewStock('0');
    load();
  };

  const deleteVariant = async (variant: ProductVariant) => {
    const msg = variant.current_stock > 0
      ? `La talla ${variant.size} tiene stock ${variant.current_stock}. ¿Eliminarla? Se borrarán también sus movimientos.`
      : `¿Eliminar la talla ${variant.size}? Se borrarán también sus movimientos.`;
    if (!confirm(msg)) return;
    const { error: delErr } = await supabase.from('product_variants').delete().eq('id', variant.id);
    if (delErr) { setError(delErr.message); return; }
    load();
  };

  const selectedCategory = categories.find((c) => c.id === formData.category_id);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-gray-500 mb-4">{error || 'Producto no encontrado'}</p>
        <Link href="/products" className="text-blue-600 hover:text-blue-700">← Volver a productos</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/products" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Productos
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Editar Producto</h1>
          {formData.status === 'discontinued' && (
            <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">Descontinuado</span>
          )}
        </div>
        <p className="text-gray-500 mt-1">Actualiza los datos del producto y sus tallas</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Product data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Datos del producto</h2>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Código *</label>
              <input
                type="text" value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Precio *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number" step="1" min="0" value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  placeholder="0"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
            <input
              type="text" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
            <div className="flex gap-2 items-center">
              {selectedCategory && (
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCategory.color }} />
              )}
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'active' })}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    formData.status === 'active'
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Activo
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'discontinued' })}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    formData.status === 'discontinued'
                      ? 'bg-gray-100 border-gray-400 text-gray-700'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Descontinuado
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Descontinuado oculta los botones +/− del producto
              </p>
            </div>

            {/* Low stock threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Umbral de stock bajo</label>
              <input
                type="number" min="0" value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Tallas con stock ≤ este valor muestran badge amarillo
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit" disabled={saving}
              className="flex-1 bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
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

      {/* Variants */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Tallas</h2>
        {variants.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">Este producto no tiene tallas.</p>
        ) : (
          <div className="space-y-2 mb-6">
            {[...variants]
              .sort((a, b) => a.size.localeCompare(b.size))
              .map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-white border border-gray-200 rounded text-sm font-semibold uppercase">{v.size}</span>
                    <span className="text-sm text-gray-600">Stock: {v.current_stock}</span>
                  </div>
                  <button onClick={() => deleteVariant(v)} className="text-sm text-red-600 hover:text-red-700">
                    Eliminar
                  </button>
                </div>
              ))}
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Agregar nueva talla</label>
          <div className="flex gap-2">
            <input
              type="text" value={newSize} onChange={(e) => setNewSize(e.target.value)}
              placeholder="Talla (ej. XL)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 uppercase"
            />
            <input
              type="number" min="0" value={newStock} onChange={(e) => setNewStock(e.target.value)}
              placeholder="Stock"
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
            <button
              type="button" onClick={addVariant}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              Agregar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            El stock inicial aquí no genera un movimiento. Usá los botones `+` / `−` en la lista para registrar entradas y salidas con traza.
          </p>
        </div>
      </div>
    </div>
  );
}
