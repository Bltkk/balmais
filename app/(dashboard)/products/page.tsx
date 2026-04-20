'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Product, ProductVariant } from '@/types/database';

type ProductWithVariants = Product & { variants: ProductVariant[] };

interface MovementTarget {
  productName: string;
  variant: ProductVariant;
  type: 'in' | 'out';
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('code');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<MovementTarget | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProducts([]);
        return;
      }

      let query = supabase
        .from('products')
        .select('*, variants:product_variants(*)')
        .eq('user_id', user.id);

      if (search) {
        query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
      }

      query = query.order(sortBy, { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      setProducts((data || []) as ProductWithVariants[]);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [search, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto y todas sus tallas y movimientos?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto');
    }
  };

  const totalStock = (p: ProductWithVariants) =>
    p.variants.reduce((sum, v) => sum + v.current_stock, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500 mt-1">Gestiona tu inventario por talla</p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Producto
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              />
            </div>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
          >
            <option value="code">Ordenar por Código</option>
            <option value="name">Ordenar por Nombre</option>
            <option value="price">Ordenar por Precio</option>
            <option value="created_at">Ordenar por Fecha</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-500">Cargando...</p>
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => {
                  const stock = totalStock(product);
                  const isOpen = expanded.has(product.id);
                  return (
                    <>
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleExpand(product.id)}
                            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900"
                            title={isOpen ? 'Ocultar tallas' : 'Ver tallas'}
                          >
                            <svg
                              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${product.price.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              stock > 10
                                ? 'bg-green-100 text-green-800'
                                : stock > 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {stock}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          ${(product.price * stock).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                          <Link href={`/products/${product.id}`} className="text-blue-600 hover:text-blue-700">
                            Editar
                          </Link>
                          <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-700">
                            Eliminar
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${product.id}-expanded`} className="bg-gray-50/50">
                          <td></td>
                          <td colSpan={6} className="px-6 py-4">
                            {product.variants.length === 0 ? (
                              <p className="text-sm text-gray-500">Este producto no tiene tallas cargadas.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {[...product.variants]
                                  .sort((a, b) => a.size.localeCompare(b.size))
                                  .map((v) => (
                                    <div
                                      key={v.id}
                                      className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2"
                                    >
                                      <span className="text-xs font-semibold text-gray-500 uppercase">{v.size}</span>
                                      <span className="text-sm font-medium text-gray-900">{v.current_stock}</span>
                                      <div className="flex gap-1 ml-2">
                                        <button
                                          onClick={() => setTarget({ productName: product.name, variant: v, type: 'in' })}
                                          className="w-7 h-7 flex items-center justify-center bg-green-100 text-green-700 rounded hover:bg-green-200"
                                          title="Sumar stock"
                                        >
                                          +
                                        </button>
                                        <button
                                          onClick={() => setTarget({ productName: product.name, variant: v, type: 'out' })}
                                          disabled={v.current_stock === 0}
                                          className="w-7 h-7 flex items-center justify-center bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                          title="Restar stock"
                                        >
                                          −
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos</h3>
            <p className="text-gray-500 mb-6">Comienza agregando tu primer producto al inventario</p>
            <Link
              href="/products/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Crear Primer Producto
            </Link>
          </div>
        )}
      </div>

      {target && (
        <StockMovementModal
          target={target}
          onClose={() => setTarget(null)}
          onSuccess={() => {
            setTarget(null);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}

function StockMovementModal({
  target,
  onClose,
  onSuccess,
}: {
  target: MovementTarget;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isIn = target.type === 'in';
  const max = target.variant.current_stock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }
    if (!isIn && qty > max) {
      setError(`Stock insuficiente (disponible: ${max})`);
      return;
    }

    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('register_stock_movement', {
      p_variant_id: target.variant.id,
      p_type: target.type,
      p_quantity: qty,
      p_notes: notes || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isIn ? 'Entrada de stock' : 'Salida de stock'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {target.productName} · Talla <span className="font-semibold">{target.variant.size}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">Stock actual: {max}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad a {isIn ? 'sumar' : 'restar'} *
            </label>
            <input
              type="number"
              min="1"
              max={isIn ? undefined : max}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nota (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isIn ? 'ej. Compra a proveedor' : 'ej. Venta mostrador'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 ${
                isIn ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting ? 'Guardando...' : isIn ? 'Sumar stock' : 'Restar stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
