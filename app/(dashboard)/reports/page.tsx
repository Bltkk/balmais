'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface MovementRow {
  id: string;
  type: 'in' | 'out' | 'adjustment';
  product: string;
  product_code: string;
  size: string;
  quantity: number;
  stock_after: number;
  sale_price: number | null;
  commission: number;
  date: string;
}

const fmt = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [rawMovements, setRawMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRawMovements([]);
        return;
      }

      let query = supabase
        .from('stock_movements')
        .select('id, type, quantity, stock_after, sale_price, commission, created_at, variant:product_variants(size, product:products(name, code))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query = query.lte('created_at', to.toISOString());
      }
      if (typeFilter) query = query.eq('type', typeFilter);

      const { data, error } = await query;
      if (error) throw error;

      setRawMovements(
        (data || []).map((m: any) => ({
          id: m.id,
          type: m.type,
          product: m.variant?.product?.name || '—',
          product_code: m.variant?.product?.code || '',
          size: m.variant?.size || '',
          quantity: m.quantity,
          stock_after: m.stock_after,
          sale_price: m.sale_price ?? null,
          commission: m.commission ?? 0,
          date: new Date(m.created_at).toLocaleString('es'),
        }))
      );
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, typeFilter]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Client-side filters
  const productOptions = [...new Set(rawMovements.map((m) => m.product))].filter(Boolean).sort();
  const sizeOptions = [...new Set(
    (productFilter ? rawMovements.filter((m) => m.product === productFilter) : rawMovements)
      .map((m) => m.size)
  )].filter(Boolean).sort();

  const movements = rawMovements.filter(
    (m) => (!productFilter || m.product === productFilter) && (!sizeFilter || m.size === sizeFilter)
  );

  const handleProductChange = (val: string) => {
    setProductFilter(val);
    setSizeFilter('');
  };

  const exportCSV = () => {
    const header = ['Fecha', 'Tipo', 'Código', 'Producto', 'Talla', 'Cantidad', 'Precio venta', 'Comisión', 'Stock Final'];
    const rows = movements.map((m) => [
      m.date,
      m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Salida' : m.quantity > 0 ? 'Ajuste ▲' : 'Ajuste ▼',
      m.product_code,
      m.product,
      m.size,
      m.quantity.toString(),
      m.type === 'out' && m.sale_price !== null ? m.sale_price.toString() : '',
      m.type === 'out' && m.commission > 0 ? m.commission.toString() : '',
      m.stock_after.toString(),
    ]);

    const escapeCell = (value: string) => {
      const str = String(value);
      const needsPrefix = /^[=+\-@\t\r]/.test(str);
      const safe = (needsPrefix ? `'${str}` : str).replace(/"/g, '""');
      return `"${safe}"`;
    };

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCell).join(','))
      .join('\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 mt-1">Historial de movimientos de stock por talla</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={movements.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        {/* Row 1: date range + type */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="">Todos</option>
              <option value="in">Entradas</option>
              <option value="out">Salidas</option>
              <option value="adjustment">Ajustes</option>
            </select>
          </div>
        </div>

        {/* Row 2: product + size */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
            <select
              value={productFilter}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="">Todos los productos</option>
              {productOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Talla</label>
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              disabled={sizeOptions.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:opacity-50"
            >
              <option value="">Todas las tallas</option>
              {sizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {(productFilter || sizeFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => { setProductFilter(''); setSizeFilter(''); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>

        {/* Active filter summary */}
        {(productFilter || sizeFilter || typeFilter || dateFrom || dateTo) && (
          <p className="text-xs text-gray-400">
            Mostrando {movements.length} de {rawMovements.length} movimientos
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-500">Cargando...</p>
          </div>
        ) : movements.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Talla</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio venta</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{m.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {m.type === 'in' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Entrada</span>
                      )}
                      {m.type === 'out' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Salida</span>
                      )}
                      {m.type === 'adjustment' && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.quantity > 0 ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                          Ajuste {m.quantity > 0 ? '▲' : '▼'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{m.product_code}</span> — {m.product}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium uppercase">{m.size}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      {m.type === 'in' && <span className="text-green-600">+{m.quantity}</span>}
                      {m.type === 'out' && <span className="text-red-600">-{m.quantity}</span>}
                      {m.type === 'adjustment' && (
                        <span className={m.quantity > 0 ? 'text-blue-600' : 'text-orange-600'}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {m.type === 'out' && m.sale_price !== null
                        ? <span className={m.sale_price !== null ? 'text-amber-600 font-medium' : ''}>{fmt(m.sale_price)}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {m.type === 'out' && m.commission > 0
                        ? <span className="text-purple-700 font-medium">{fmt(m.commission)}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{m.stock_after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay movimientos</h3>
            <p className="text-gray-500">
              {rawMovements.length > 0
                ? 'Ningún movimiento coincide con los filtros aplicados'
                : 'Los movimientos aparecerán aquí al sumar o restar stock'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
