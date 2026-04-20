'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type Period = '7d' | '30d' | '90d' | '365d' | 'all';
type ChartType = 'line' | 'bar';
type Metric = 'qty' | 'value';

interface RawMovement {
  type: 'in' | 'out';
  quantity: number;
  created_at: string;
  variant: {
    product: { id: string; name: string; price: number };
  } | null;
}

interface ProductStock {
  name: string;
  stock: number;
  value: number;
}

interface TimePoint {
  label: string;
  Entradas: number;
  Salidas: number;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Semana', value: '7d' },
  { label: 'Mes', value: '30d' },
  { label: '3 meses', value: '90d' },
  { label: '1 año', value: '365d' },
  { label: 'Todo', value: 'all' },
];

function getFromDate(period: Period): Date | null {
  if (period === 'all') return null;
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[period];
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getBucketKey(date: Date, period: Period): string {
  if (period === '7d' || period === '30d') {
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  }
  if (period === '90d') {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  }
  return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
}

const fmt = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [metric, setMetric] = useState<Metric>('value');
  const [movements, setMovements] = useState<RawMovement[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Movements for the period
    const from = getFromDate(p);
    let q = supabase
      .from('stock_movements')
      .select('type, quantity, created_at, variant:product_variants(product:products(id, name, price))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (from) q = q.gte('created_at', from.toISOString());

    const { data: mvs } = await q;
    setMovements((mvs as unknown as RawMovement[]) || []);

    // Current stock per product
    const { data: products } = await supabase
      .from('products')
      .select('name, price, variants:product_variants(current_stock)')
      .eq('user_id', user.id)
      .order('name');

    setProductStocks(
      ((products || []) as { name: string; price: number; variants: { current_stock: number }[] }[]).map((p) => {
        const stock = p.variants.reduce((s, v) => s + v.current_stock, 0);
        return { name: p.name, stock, value: stock * p.price };
      })
    );

    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  // Build time series chart data
  const timeData: TimePoint[] = (() => {
    const map = new Map<string, { in: number; out: number }>();
    for (const m of movements) {
      const key = getBucketKey(new Date(m.created_at), period);
      const price = m.variant?.product?.price ?? 0;
      const val = metric === 'qty' ? m.quantity : m.quantity * price;
      const entry = map.get(key) ?? { in: 0, out: 0 };
      if (m.type === 'in') entry.in += val;
      else entry.out += val;
      map.set(key, entry);
    }
    return Array.from(map.entries()).map(([label, v]) => ({
      label,
      Entradas: Math.round(v.in * 100) / 100,
      Salidas: Math.round(v.out * 100) / 100,
    }));
  })();

  // Build per-product bar data
  const productData = (() => {
    const map = new Map<string, { in: number; out: number }>();
    for (const m of movements) {
      const name = m.variant?.product?.name ?? 'Desconocido';
      const price = m.variant?.product?.price ?? 0;
      const val = metric === 'qty' ? m.quantity : m.quantity * price;
      const entry = map.get(name) ?? { in: 0, out: 0 };
      if (m.type === 'in') entry.in += val;
      else entry.out += val;
      map.set(name, entry);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name: name.length > 16 ? name.slice(0, 14) + '…' : name,
        Entradas: Math.round(v.in * 100) / 100,
        Salidas: Math.round(v.out * 100) / 100,
      }))
      .sort((a, b) => b.Entradas + b.Salidas - (a.Entradas + a.Salidas));
  })();

  const tooltipFmt = (value: number | string) => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return metric === 'value' ? fmt(n) : `${n} u.`;
  };
  const yFmt = (v: number) => metric === 'value' ? `$${(v / 1000).toFixed(0)}k` : String(v);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analíticas</h1>
        <p className="text-gray-500 mt-1">Visualiza el comportamiento de tu inventario</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.value ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setMetric('value')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${metric === 'value' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Valor ($)
          </button>
          <button
            onClick={() => setMetric('qty')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${metric === 'qty' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Unidades
          </button>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${chartType === 'line' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Linea
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${chartType === 'bar' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Barras
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Time series chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Movimientos en el tiempo — {metric === 'value' ? 'Valor ($)' : 'Unidades'}
            </h2>
            {timeData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                No hay movimientos en el período seleccionado
              </div>
            ) : chartType === 'line' ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" tickFormatter={yFmt} />
                  { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                  <Tooltip formatter={tooltipFmt as any} />
                  <Legend />
                  <Line type="monotone" dataKey="Entradas" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Salidas" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" tickFormatter={yFmt} />
                  { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                  <Tooltip formatter={tooltipFmt as any} />
                  <Legend />
                  <Bar dataKey="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Salidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Per-product movement chart */}
          {productData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Movimientos por producto — {metric === 'value' ? 'Valor ($)' : 'Unidades'}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" tickFormatter={yFmt} />
                  { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                  <Tooltip formatter={tooltipFmt as any} />
                  <Legend />
                  <Bar dataKey="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Salidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stock value by product */}
          {productStocks.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Stock actual por producto — {metric === 'value' ? 'Valor ($)' : 'Unidades'}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={productStocks.map((p) => ({
                    name: p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name,
                    Stock: metric === 'value' ? Math.round(p.value) : p.stock,
                  }))}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" tickFormatter={yFmt} />
                  { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                  <Tooltip formatter={tooltipFmt as any} />
                  <Bar dataKey="Stock" radius={[3, 3, 0, 0]}>
                    {productStocks.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
