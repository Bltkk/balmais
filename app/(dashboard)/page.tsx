'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type Period = '7d' | '30d' | '90d' | '365d' | 'all';
type Metric = 'qty' | 'value';

interface RawMovement {
  id: string;
  type: 'in' | 'out';
  quantity: number;
  created_at: string;
  variant: { product: { price: number; name: string } } | null;
}

interface ChartPoint {
  label: string;
  Entradas: number;
  Salidas: number;
}

interface PeriodSummary {
  inQty: number;
  outQty: number;
  inVal: number;
  outVal: number;
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

function buildChart(movements: RawMovement[], period: Period, metric: Metric): ChartPoint[] {
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
}

function buildSummary(movements: RawMovement[]): PeriodSummary {
  return movements.reduce(
    (acc, m) => {
      const val = m.quantity * (m.variant?.product?.price ?? 0);
      if (m.type === 'in') { acc.inQty += m.quantity; acc.inVal += val; }
      else { acc.outQty += m.quantity; acc.outVal += val; }
      return acc;
    },
    { inQty: 0, outQty: 0, inVal: 0, outVal: 0 }
  );
}

const fmt = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [metric, setMetric] = useState<Metric>('value');
  const [totals, setTotals] = useState({ products: 0, stock: 0, value: 0, todayMovements: 0, returnPotential: 0 });
  const [movements, setMovements] = useState<RawMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTotals();
  }, []);

  useEffect(() => {
    loadMovements(period);
  }, [period]);

  const loadTotals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prods } = await supabase
      .from('products')
      .select('id, price, cost')
      .eq('user_id', user.id);

    const prodList = prods || [];
    const prodMap = new Map(
      prodList.map((p) => [p.id as string, { price: p.price as number, cost: (p.cost ?? 0) as number }])
    );

    const { data: variants } = prodList.length
      ? await supabase
          .from('product_variants')
          .select('product_id, current_stock')
          .in('product_id', prodList.map((p) => p.id))
      : { data: [] };

    const varList = (variants || []) as { product_id: string; current_stock: number }[];
    const stock = varList.reduce((s, v) => s + v.current_stock, 0);
    const value = varList.reduce((s, v) => s + (prodMap.get(v.product_id)?.price ?? 0) * v.current_stock, 0);
    const returnPotential = varList.reduce((s, v) => {
      const p = prodMap.get(v.product_id);
      return s + (p ? (p.price - p.cost) * v.current_stock : 0);
    }, 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString());

    setTotals({ products: prodList.length, stock, value, todayMovements: count || 0, returnPotential });
  };

  const loadMovements = useCallback(async (p: Period) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const from = getFromDate(p);
    let query = supabase
      .from('stock_movements')
      .select('id, type, quantity, created_at, variant:product_variants(product:products(price, name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (from) query = query.gte('created_at', from.toISOString());

    const { data } = await query;
    setMovements((data as unknown as RawMovement[]) || []);
    setLoading(false);
  }, []);

  const chartData = buildChart(movements, period, metric);
  const summary = buildSummary(movements);

  const stats = [
    { label: 'Productos', value: totals.products.toString(), color: 'bg-blue-500', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { label: 'Stock Total', value: totals.stock.toString(), color: 'bg-green-500', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
    { label: 'Valor Inventario', value: fmt(totals.value), color: 'bg-yellow-500', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Movimientos Hoy', value: totals.todayMovements.toString(), color: 'bg-purple-500', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Resumen de tu inventario</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 truncate">{s.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1 truncate">{s.value}</p>
              </div>
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center shrink-0 ml-2`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Retorno Potencial */}
      {totals.returnPotential > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Retorno Potencial</p>
                <p className="text-2xl font-bold text-emerald-800">{fmt(totals.returnPotential)}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Ganancia bruta si vendés todo el stock actual</p>
              </div>
            </div>
            <div className="flex gap-6 sm:gap-8 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Valor inventario</p>
                <p className="font-semibold text-gray-800">{fmt(totals.value)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Margen global</p>
                <p className="font-semibold text-emerald-700">
                  {totals.value > 0 ? Math.round((totals.returnPotential / totals.value) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period + Metric selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.value
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setMetric('value')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              metric === 'value' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Valor ($)
          </button>
          <button
            onClick={() => setMetric('qty')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              metric === 'qty' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Unidades
          </button>
        </div>
      </div>

      {/* Movement chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Movimientos de Stock</h2>
          <Link href="/analytics" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Ver analíticas →
          </Link>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            No hay movimientos en el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#d1d5db" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#d1d5db"
                tickFormatter={(v) => metric === 'value' ? `$${(v / 1000).toFixed(0)}k` : String(v)}
              />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={((value: number) => metric === 'value' ? fmt(value) : `${value} u.`) as any} />
              <Legend />
              <Line
                type="monotone"
                dataKey="Entradas"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Salidas"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Period summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen del período</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-green-800">Entradas</p>
                <p className="text-2xl font-bold text-green-700">{summary.inQty.toLocaleString('es-CL')} u.</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-600">Valor ingresado</p>
                <p className="text-lg font-semibold text-green-700">{fmt(summary.inVal)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-red-800">Salidas</p>
                <p className="text-2xl font-bold text-red-700">{summary.outQty.toLocaleString('es-CL')} u.</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-red-600">Valor egresado</p>
                <p className="text-lg font-semibold text-red-700">{fmt(summary.outVal)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Diferencia neta</p>
                <p className={`text-2xl font-bold ${summary.inQty - summary.outQty >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                  {(summary.inQty - summary.outQty) >= 0 ? '+' : ''}{(summary.inQty - summary.outQty).toLocaleString('es-CL')} u.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Neto en valor</p>
                <p className={`text-lg font-semibold ${summary.inVal - summary.outVal >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                  {(summary.inVal - summary.outVal) >= 0 ? '+' : ''}{fmt(Math.abs(summary.inVal - summary.outVal))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-1 gap-3">
            <Link href="/products/new" className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Nuevo Producto</p>
                <p className="text-sm text-gray-500">Agregar al inventario</p>
              </div>
            </Link>
            <Link href="/products" className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Ver Productos</p>
                <p className="text-sm text-gray-500">Stock por talla</p>
              </div>
            </Link>
            <Link href="/analytics" className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
              <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Analíticas</p>
                <p className="text-sm text-gray-500">Gráficas por producto</p>
              </div>
            </Link>
            <Link href="/reports" className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Reportes</p>
                <p className="text-sm text-gray-500">Historial y exportar CSV</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
