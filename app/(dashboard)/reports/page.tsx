'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface MovementRow {
  id: string;
  type: 'in' | 'out';
  product: string;
  product_code: string;
  size: string;
  quantity: number;
  stock_after: number;
  date: string;
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMovements([]);
        return;
      }

      let query = supabase
        .from('stock_movements')
        .select('id, type, quantity, stock_after, created_at, variant:product_variants(size, product:products(name, code))')
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

      setMovements(
        (data || []).map((m: any) => ({
          id: m.id,
          type: m.type,
          product: m.variant?.product?.name || '—',
          product_code: m.variant?.product?.code || '',
          size: m.variant?.size || '',
          quantity: m.quantity,
          stock_after: m.stock_after,
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

  const exportCSV = () => {
    const header = ['Fecha', 'Tipo', 'Código', 'Producto', 'Talla', 'Cantidad', 'Stock Final'];
    const rows = movements.map((m) => [
      m.date,
      m.type === 'in' ? 'Entrada' : 'Salida',
      m.product_code,
      m.product,
      m.size,
      m.quantity.toString(),
      m.stock_after.toString(),
    ]);

    // Previene CSV injection: valores que empiezan con =, +, -, @, TAB o CR
    // son interpretados como fórmula por Excel/Sheets. Los neutralizamos
    // prefijándolos con una comilla simple y además escapamos dobles comillas.
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
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
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="">Todos</option>
              <option value="in">Entradas</option>
              <option value="out">Salidas</option>
            </select>
          </div>
        </div>
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{m.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {m.type === 'in' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{m.product_code}</span> — {m.product}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium uppercase">{m.size}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <span className={m.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                        {m.type === 'in' ? '+' : '-'}{m.quantity}
                      </span>
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
            <p className="text-gray-500">Los movimientos aparecerán aquí al sumar o restar stock</p>
          </div>
        )}
      </div>
    </div>
  );
}
