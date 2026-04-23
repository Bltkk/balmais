'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

type Period = '7d' | '30d' | '90d' | '365d' | 'all';
type ChartType = 'line' | 'bar';
type Metric = 'qty' | 'value';

interface RawMovement {
  type: 'in' | 'out';
  quantity: number;
  created_at: string;
  variant: {
    size: string;
    product: { id: string; name: string; price: number; cost: number };
  } | null;
}

interface ProductStock {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  value: number;
  variants: { size: string; current_stock: number }[];
}

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Semana', value: '7d' },
  { label: 'Mes', value: '30d' },
  { label: '3 meses', value: '90d' },
  { label: '1 año', value: '365d' },
  { label: 'Todo', value: 'all' },
];

const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = {
  '7d': 7, '30d': 30, '90d': 90, '365d': 365,
};

function getFromDate(period: Period): Date | null {
  if (period === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - PERIOD_DAYS[period]);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPrevDateRange(period: Period): { from: Date | null; to: Date } {
  if (period === 'all') return { from: null, to: new Date() };
  const days = PERIOD_DAYS[period];
  const to = new Date();
  to.setDate(to.getDate() - days);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
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
const ABC_COLORS = { A: '#22c55e', B: '#f59e0b', C: '#94a3b8' };

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color = 'slate', delta,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: 'slate' | 'green' | 'yellow' | 'red' | 'blue';
  delta?: { value: number; label: string };
}) {
  const bg: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${bg[color]}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      {delta !== undefined && (
        <p className={`text-xs font-medium mt-1 ${delta.value >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {delta.value >= 0 ? '▲' : '▼'} {Math.abs(delta.value).toFixed(1)}% {delta.label}
        </p>
      )}
    </div>
  );
}

// ─── Scatter tooltip ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScatterTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{d.name}</p>
      <p className="text-gray-600">Ventas período: <span className="font-medium text-gray-900">{d.x} u.</span></p>
      <p className="text-gray-600">Stock actual: <span className="font-medium text-gray-900">{d.y} u.</span></p>
      {d.margin !== undefined && (
        <p className="text-gray-600">Margen/u: <span className="font-medium text-gray-900">{fmt(d.margin)}</span></p>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [metric, setMetric] = useState<Metric>('value');
  const [movements, setMovements] = useState<RawMovement[]>([]);
  const [prevMovements, setPrevMovements] = useState<RawMovement[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [productList, setProductList] = useState<{ id: string; name: string }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const from = getFromDate(p);
    const { from: prevFrom, to: prevTo } = getPrevDateRange(p);

    const movQuery = (gte: Date | null, lte?: Date) => {
      let q = supabase
        .from('stock_movements')
        .select('type, quantity, created_at, variant:product_variants(size, product:products(id, name, price, cost))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (gte) q = q.gte('created_at', gte.toISOString());
      if (lte) q = q.lte('created_at', lte.toISOString());
      return q;
    };

    const [{ data: mvs }, { data: prevMvs }, { data: products }] = await Promise.all([
      movQuery(from),
      p !== 'all' ? movQuery(prevFrom, prevTo) : Promise.resolve({ data: [] }),
      supabase
        .from('products')
        .select('id, name, price, cost, variants:product_variants(size, current_stock)')
        .eq('user_id', user.id)
        .order('name'),
    ]);

    setMovements((mvs as unknown as RawMovement[]) || []);
    setPrevMovements((prevMvs as unknown as RawMovement[]) || []);

    const parsed = ((products || []) as {
      id: string; name: string; price: number; cost: number;
      variants: { size: string; current_stock: number }[];
    }[]);

    setProductList(parsed.map((pr) => ({ id: pr.id, name: pr.name })));
    setProductStocks(
      parsed.map((pr) => {
        const stock = pr.variants.reduce((s, v) => s + v.current_stock, 0);
        return { id: pr.id, name: pr.name, price: pr.price, cost: pr.cost, stock, value: stock * pr.price, variants: pr.variants };
      })
    );

    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const filteredMovements = selectedProductId
    ? movements.filter((m) => m.variant?.product?.id === selectedProductId)
    : movements;

  const selectedProduct = selectedProductId
    ? productStocks.find((p) => p.id === selectedProductId) ?? null
    : null;

  // ── KPIs derivados ──────────────────────────────────────────────────────
  const totalOutQty = filteredMovements.filter((m) => m.type === 'out').reduce((s, m) => s + m.quantity, 0);
  const totalInQty = filteredMovements.filter((m) => m.type === 'in').reduce((s, m) => s + m.quantity, 0);
  const prevOutQty = (selectedProductId
    ? prevMovements.filter((m) => m.variant?.product?.id === selectedProductId)
    : prevMovements
  ).filter((m) => m.type === 'out').reduce((s, m) => s + m.quantity, 0);

  const currentStock = selectedProduct
    ? selectedProduct.stock
    : productStocks.reduce((s, p) => s + p.stock, 0);

  const periodDays = period === 'all' ? 365 : PERIOD_DAYS[period];
  const dailyOut = totalOutQty / periodDays;
  const diasInventario = dailyOut > 0 ? Math.round(currentStock / dailyOut) : null;
  const rotacion = currentStock > 0 ? (totalOutQty / currentStock) : null;
  const deltaSalidas = prevOutQty > 0 ? ((totalOutQty - prevOutQty) / prevOutQty) * 100 : null;

  // ── Time series ─────────────────────────────────────────────────────────
  const timeData = (() => {
    const map = new Map<string, { in: number; out: number }>();
    for (const m of filteredMovements) {
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

  // ── Análisis ABC ────────────────────────────────────────────────────────
  const abcData = (() => {
    if (selectedProductId) return [];
    const map = new Map<string, { out: number; stock: number }>();
    for (const m of movements) {
      if (m.type !== 'out') continue;
      const pid = m.variant?.product?.id ?? '';
      const name = m.variant?.product?.name ?? 'Desconocido';
      const key = `${pid}||${name}`;
      const entry = map.get(key) ?? { out: 0, stock: 0 };
      entry.out += m.quantity;
      map.set(key, entry);
    }
    for (const ps of productStocks) {
      const key = [...map.keys()].find((k) => k.startsWith(ps.id + '||'));
      if (key) {
        const entry = map.get(key)!;
        entry.stock = ps.stock;
        map.set(key, entry);
      }
    }
    const total = [...map.values()].reduce((s, v) => s + v.out, 0);
    if (total === 0) return [];

    const sorted = [...map.entries()]
      .map(([key, v]) => ({ name: key.split('||')[1], out: v.out }))
      .sort((a, b) => b.out - a.out);

    let cumulative = 0;
    return sorted.map((item) => {
      cumulative += item.out;
      const pct = (cumulative / total) * 100;
      const clase = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C';
      return {
        name: item.name.length > 14 ? item.name.slice(0, 12) + '…' : item.name,
        Ventas: item.out,
        clase,
        pctAcum: Math.round(pct * 10) / 10,
      };
    });
  })();

  // ── Scatter: stock vs ventas ─────────────────────────────────────────────
  const scatterData = (() => {
    if (selectedProductId) return [];
    const outByProduct = new Map<string, number>();
    for (const m of movements) {
      if (m.type !== 'out') continue;
      const pid = m.variant?.product?.id ?? '';
      outByProduct.set(pid, (outByProduct.get(pid) ?? 0) + m.quantity);
    }
    return productStocks.map((ps) => ({
      name: ps.name,
      x: outByProduct.get(ps.id) ?? 0,
      y: ps.stock,
      z: Math.max(ps.value / 1000, 10),
      margin: ps.price - ps.cost,
    }));
  })();

  const avgSales = scatterData.length
    ? scatterData.reduce((s, d) => s + d.x, 0) / scatterData.length : 0;
  const avgStock = scatterData.length
    ? scatterData.reduce((s, d) => s + d.y, 0) / scatterData.length : 0;

  // ── Heatmap de tallas ────────────────────────────────────────────────────
  const sizeHeatData = (() => {
    const map = new Map<string, number>();
    const source = selectedProductId ? filteredMovements : movements;
    for (const m of source) {
      if (m.type !== 'out') continue;
      const size = m.variant?.size ?? '?';
      map.set(size, (map.get(size) ?? 0) + m.quantity);
    }
    const max = Math.max(...map.values(), 1);
    return [...map.entries()]
      .map(([size, qty]) => ({ size, qty, pct: (qty / max) * 100 }))
      .sort((a, b) => b.qty - a.qty);
  })();

  // ── Per-product / per-size movement ──────────────────────────────────────
  const productData = (() => {
    if (selectedProductId) return [];
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
    return [...map.entries()]
      .map(([name, v]) => ({
        name: name.length > 16 ? name.slice(0, 14) + '…' : name,
        Entradas: Math.round(v.in * 100) / 100,
        Salidas: Math.round(v.out * 100) / 100,
      }))
      .sort((a, b) => b.Salidas - a.Salidas);
  })();

  const sizeMovementData = (() => {
    if (!selectedProductId) return [];
    const map = new Map<string, { in: number; out: number }>();
    for (const m of filteredMovements) {
      const size = m.variant?.size ?? '?';
      const price = m.variant?.product?.price ?? 0;
      const val = metric === 'qty' ? m.quantity : m.quantity * price;
      const entry = map.get(size) ?? { in: 0, out: 0 };
      if (m.type === 'in') entry.in += val;
      else entry.out += val;
      map.set(size, entry);
    }
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        Entradas: Math.round(v.in * 100) / 100,
        Salidas: Math.round(v.out * 100) / 100,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  // ── Stock chart ───────────────────────────────────────────────────────────
  const stockChartData = selectedProduct
    ? selectedProduct.variants
        .sort((a, b) => a.size.localeCompare(b.size))
        .map((v) => ({
          name: v.size,
          Stock: metric === 'value' ? Math.round(v.current_stock * selectedProduct.price) : v.current_stock,
        }))
    : productStocks.map((p) => ({
        name: p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name,
        Stock: metric === 'value' ? Math.round(p.value) : p.stock,
      }));

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
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Producto</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white"
          >
            <option value="">Todos los productos</option>
            {productList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

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
            Línea
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${chartType === 'bar' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Barras
          </button>
        </div>
      </div>

      {selectedProduct && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <span className="text-sm font-semibold text-slate-900">{selectedProduct.name}</span>
            <span className="text-sm text-slate-500 ml-2">
              Stock total: {selectedProduct.stock} u. · Valor: {fmt(selectedProduct.value)}
            </span>
          </div>
          <button
            onClick={() => setSelectedProductId('')}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
          >
            Ver todos
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── KPIs de gestión ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Salidas en período"
              value={`${totalOutQty} u.`}
              sub={`Entradas: ${totalInQty} u.`}
              delta={deltaSalidas !== null ? { value: deltaSalidas, label: 'vs período ant.' } : undefined}
              color="slate"
            />
            <KpiCard
              label="Rotación de inventario"
              value={rotacion !== null ? `${rotacion.toFixed(2)}x` : '—'}
              sub={rotacion !== null
                ? rotacion >= 1 ? 'Buen movimiento' : 'Stock lento'
                : 'Sin stock actual'}
              color={rotacion !== null ? (rotacion >= 1 ? 'green' : 'yellow') : 'slate'}
            />
            <KpiCard
              label="Días de inventario"
              value={diasInventario !== null ? `${diasInventario} días` : '—'}
              sub={diasInventario !== null
                ? diasInventario <= 30 ? 'Restock pronto' : 'Stock suficiente'
                : 'Sin ventas en período'}
              color={diasInventario !== null ? (diasInventario <= 30 ? 'yellow' : 'green') : 'slate'}
            />
            <KpiCard
              label="Venta / Stock total"
              value={currentStock + totalOutQty > 0
                ? `${Math.round((totalOutQty / (currentStock + totalOutQty)) * 100)}%`
                : '—'}
              sub="del inventario disponible vendido"
              color="blue"
            />
          </div>

          {/* ── Time series ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Movimientos en el tiempo
              {selectedProduct ? ` — ${selectedProduct.name}` : ''} — {metric === 'value' ? 'Valor ($)' : 'Unidades'}
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
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} />
                  <Legend />
                  <Bar dataKey="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Salidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Análisis ABC (solo vista todos) ── */}
          {!selectedProductId && abcData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-base font-semibold text-gray-900">Análisis ABC — Concentración de ventas</h2>
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> A — 80% ventas</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> B — 95%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> C — resto</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">Los productos A generan el mayor volumen — prioriza su restock.</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={abcData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" label={{ value: 'Unidades vendidas', angle: -90, position: 'insideLeft', style: { fontSize: 10 }, dx: -5 }} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload }: any) =>
                      active && payload?.length ? (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-semibold">{payload[0].payload.name}</p>
                          <p className="text-gray-600">Ventas: <span className="font-medium">{payload[0].value} u.</span></p>
                          <p className="text-gray-600">% acumulado: <span className="font-medium">{payload[0].payload.pctAcum}%</span></p>
                          <p className="text-gray-600">Clase: <span className="font-bold">{payload[0].payload.clase}</span></p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="Ventas" radius={[4, 4, 0, 0]}>
                    {abcData.map((entry, i) => (
                      <Cell key={i} fill={ABC_COLORS[entry.clase as keyof typeof ABC_COLORS]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Scatter: Stock vs Ventas ── */}
          {!selectedProductId && scatterData.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Stock actual vs Ventas del período
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                Arriba-izquierda = sobrestock · Arriba-derecha = estrella · Abajo-izquierda = lento · Abajo-derecha = riesgo de quiebre
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <span className="text-blue-600 font-bold">↑←</span>
                  <span className="text-gray-600"><span className="font-medium">Capital inmovilizado</span> — mucho stock, pocas ventas</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                  <span className="text-green-600 font-bold">↑→</span>
                  <span className="text-gray-600"><span className="font-medium">Estrella</span> — alto stock y altas ventas</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <span className="text-gray-500 font-bold">↓←</span>
                  <span className="text-gray-600"><span className="font-medium">Lento / Obsoleto</span> — bajo stock y bajas ventas</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                  <span className="text-red-600 font-bold">↓→</span>
                  <span className="text-gray-600"><span className="font-medium">Riesgo de quiebre</span> — altas ventas, bajo stock</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Ventas"
                    tick={{ fontSize: 11 }}
                    stroke="#d1d5db"
                    label={{ value: 'Ventas (u.)', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Stock"
                    tick={{ fontSize: 11 }}
                    stroke="#d1d5db"
                    label={{ value: 'Stock actual (u.)', angle: -90, position: 'insideLeft', style: { fontSize: 11 }, dx: 10 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[40, 400]} />
                  <Tooltip content={<ScatterTooltipContent />} />
                  {avgSales > 0 && (
                    <ReferenceLine x={avgSales} stroke="#94a3b8" strokeDasharray="4 4" />
                  )}
                  {avgStock > 0 && (
                    <ReferenceLine y={avgStock} stroke="#94a3b8" strokeDasharray="4 4" />
                  )}
                  <Scatter
                    data={scatterData}
                    fill="#3b82f6"
                    fillOpacity={0.7}
                  >
                    {scatterData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.75} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Heatmap de tallas ── */}
          {sizeHeatData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Salidas por talla{selectedProduct ? ` — ${selectedProduct.name}` : ''}
              </h2>
              <p className="text-xs text-gray-400 mb-4">Qué tallas se venden más — útil para optimizar compras.</p>
              <div className="space-y-2">
                {sizeHeatData.map((item) => (
                  <div key={item.size} className="flex items-center gap-3">
                    <span className="w-12 text-sm font-medium text-gray-700 text-right">{item.size}</span>
                    <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md flex items-center px-2 transition-all duration-500"
                        style={{
                          width: `${Math.max(item.pct, 4)}%`,
                          background: `hsl(${220 - item.pct * 1.4}, 70%, 50%)`,
                        }}
                      >
                        <span className="text-white text-xs font-semibold">{item.qty} u.</span>
                      </div>
                    </div>
                    <span className="w-10 text-xs text-gray-400">{item.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Movimientos por talla (producto seleccionado) ── */}
          {selectedProductId && sizeMovementData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Movimientos por talla — {metric === 'value' ? 'Valor ($)' : 'Unidades'}
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sizeMovementData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" tickFormatter={yFmt} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} />
                  <Legend />
                  <Bar dataKey="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Salidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Movimientos por producto (vista todos) ── */}
          {!selectedProductId && productData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Movimientos por producto — {metric === 'value' ? 'Valor ($)' : 'Unidades'}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" tickFormatter={yFmt} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} />
                  <Legend />
                  <Bar dataKey="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Salidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Stock actual ── */}
          {stockChartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                {selectedProduct
                  ? `Stock actual por talla — ${selectedProduct.name}`
                  : 'Stock actual por producto'}
                {' '}— {metric === 'value' ? 'Valor ($)' : 'Unidades'}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stockChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: selectedProduct ? 12 : 11 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" tickFormatter={yFmt} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} />
                  <Bar dataKey="Stock" radius={[3, 3, 0, 0]}>
                    {stockChartData.map((_, i) => (
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
