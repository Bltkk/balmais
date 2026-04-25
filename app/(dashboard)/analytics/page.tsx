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
  sale_price: number | null;
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

function generateAllBuckets(from: Date | null, period: Period, fallbackStart?: Date): string[] {
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);

  const periodStart = from ?? fallbackStart;
  if (!periodStart) return [];
  // Arranca desde el primer movimiento real si es posterior al inicio del período
  const start = fallbackStart && fallbackStart > periodStart ? fallbackStart : periodStart;

  const buckets: string[] = [];
  const seen = new Set<string>();

  if (period === '7d' || period === '30d') {
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    while (cur <= yesterday) {
      const key = cur.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
      if (!seen.has(key)) { buckets.push(key); seen.add(key); }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (period === '90d') {
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    cur.setDate(cur.getDate() - cur.getDay());
    while (cur <= yesterday) {
      const key = cur.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
      if (!seen.has(key)) { buckets.push(key); seen.add(key); }
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
    while (cur <= endMonth) {
      const key = cur.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
      if (!seen.has(key)) { buckets.push(key); seen.add(key); }
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  return buckets;
}

const fmt = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

// Paleta coherente para gráficos de stock
const PALETTE = [
  '#6366f1', '#8b5cf6', '#a78bfa',
  '#06b6d4', '#0ea5e9', '#38bdf8',
  '#10b981', '#34d399',
  '#f59e0b', '#fbbf24',
  '#f43f5e', '#fb7185',
];

const ABC_COLORS = { A: '#10b981', B: '#f59e0b', C: '#94a3b8' };
const IN_COLOR  = '#6366f1';  // indigo — entradas
const OUT_COLOR = '#f43f5e';  // rose   — salidas

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, gradient, delta,
}: {
  label: string;
  value: string;
  sub?: string;
  gradient: string;
  delta?: { value: number; label: string };
}) {
  return (
    <div className={`rounded-2xl p-5 text-white ${gradient} shadow-md`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{label}</p>
      </div>
      <p className="text-3xl font-extrabold mt-2 leading-none">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
      {delta !== undefined && (
        <p className="text-xs font-semibold mt-2 opacity-90">
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
    <div className="bg-white border border-gray-100 rounded-xl shadow-xl p-3 text-sm">
      <p className="font-bold text-gray-900 mb-1">{d.name}</p>
      <p className="text-gray-500">Ventas: <span className="font-semibold text-gray-800">{d.x} u.</span></p>
      <p className="text-gray-500">Stock: <span className="font-semibold text-gray-800">{d.y} u.</span></p>
      {d.margin !== undefined && (
        <p className="text-gray-500">Margen/u: <span className="font-semibold text-gray-800">{fmt(d.margin)}</span></p>
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const from = getFromDate(p);
    const { from: prevFrom, to: prevTo } = getPrevDateRange(p);

    const movQuery = (gte: Date | null, lte?: Date) => {
      let q = supabase
        .from('stock_movements')
        .select('type, quantity, sale_price, created_at, variant:product_variants(size, product:products(id, name, price, cost))')
        .eq('user_id', user.id)
        .lt('created_at', startOfToday.toISOString())
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

  // ── KPIs ────────────────────────────────────────────────────────────────
  const totalOutQty = filteredMovements.filter((m) => m.type === 'out').reduce((s, m) => s + m.quantity, 0);
  const totalInQty  = filteredMovements.filter((m) => m.type === 'in').reduce((s, m) => s + m.quantity, 0);
  const prevOutQty  = (selectedProductId
    ? prevMovements.filter((m) => m.variant?.product?.id === selectedProductId)
    : prevMovements
  ).filter((m) => m.type === 'out').reduce((s, m) => s + m.quantity, 0);

  const currentStock  = selectedProduct
    ? selectedProduct.stock
    : productStocks.reduce((s, p) => s + p.stock, 0);

  const periodDays    = period === 'all' ? 365 : PERIOD_DAYS[period];
  const dailyOut      = totalOutQty / periodDays;
  const diasInventario = dailyOut > 0 ? Math.round(currentStock / dailyOut) : null;
  const rotacion      = currentStock > 0 ? totalOutQty / currentStock : null;
  const deltaSalidas  = prevOutQty > 0 ? ((totalOutQty - prevOutQty) / prevOutQty) * 100 : null;

  // ── Time series ──────────────────────────────────────────────────────────
  const timeData = (() => {
    const from = getFromDate(period);
    const fallbackStart = filteredMovements.length > 0
      ? new Date(Math.min(...filteredMovements.map((m) => new Date(m.created_at).getTime())))
      : undefined;
    const allBuckets = generateAllBuckets(from, period, fallbackStart);

    const map = new Map<string, { in: number; out: number }>(
      allBuckets.map((b) => [b, { in: 0, out: 0 }])
    );

    for (const m of filteredMovements) {
      const key        = getBucketKey(new Date(m.created_at), period);
      const fullPrice  = m.variant?.product?.price ?? 0;
      const unitPrice  = m.type === 'out' ? (m.sale_price ?? fullPrice) : fullPrice;
      const val        = metric === 'qty' ? m.quantity : m.quantity * unitPrice;
      const entry      = map.get(key) ?? { in: 0, out: 0 };
      if (m.type === 'in') entry.in += val; else entry.out += val;
      map.set(key, entry);
    }

    return allBuckets.map((label) => {
      const v = map.get(label) ?? { in: 0, out: 0 };
      return {
        label,
        Entradas: Math.round(v.in * 100) / 100,
        Salidas:  Math.round(v.out * 100) / 100,
      };
    });
  })();

  // ── Evolución del stock ──────────────────────────────────────────────────
  const stockEvolutionData = (() => {
    const from = getFromDate(period);
    const fallbackStart = filteredMovements.length > 0
      ? new Date(Math.min(...filteredMovements.map((m) => new Date(m.created_at).getTime())))
      : undefined;
    const allBuckets = generateAllBuckets(from, period, fallbackStart);
    if (allBuckets.length === 0) return [];

    const endStock = selectedProduct
      ? selectedProduct.stock
      : productStocks.reduce((s, p) => s + p.stock, 0);

    const totalIn  = filteredMovements.filter((m) => m.type === 'in').reduce((s, m) => s + m.quantity, 0);
    const totalOut = filteredMovements.filter((m) => m.type === 'out').reduce((s, m) => s + m.quantity, 0);

    const netByBucket = new Map<string, number>();
    for (const m of filteredMovements) {
      const key = getBucketKey(new Date(m.created_at), period);
      netByBucket.set(key, (netByBucket.get(key) ?? 0) + (m.type === 'in' ? m.quantity : -m.quantity));
    }

    let running = Math.max(0, endStock - totalIn + totalOut);
    return allBuckets.map((label) => {
      running = Math.max(0, running + (netByBucket.get(label) ?? 0));
      return { label, Stock: running };
    });
  })();

  // ── Análisis ABC ─────────────────────────────────────────────────────────
  const abcData = (() => {
    if (selectedProductId) return [];
    const map = new Map<string, number>();
    for (const m of movements) {
      if (m.type !== 'out') continue;
      const key = `${m.variant?.product?.id}||${m.variant?.product?.name ?? 'Desconocido'}`;
      map.set(key, (map.get(key) ?? 0) + m.quantity);
    }
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    const sorted = [...map.entries()]
      .map(([key, out]) => ({ name: key.split('||')[1], out }))
      .sort((a, b) => b.out - a.out);
    let cumulative = 0;
    return sorted.map((item) => {
      cumulative += item.out;
      const pct   = (cumulative / total) * 100;
      const clase = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C';
      return {
        name: item.name.length > 14 ? item.name.slice(0, 12) + '…' : item.name,
        Ventas: item.out,
        clase,
        pctAcum: Math.round(pct * 10) / 10,
      };
    });
  })();

  // ── Scatter ──────────────────────────────────────────────────────────────
  const scatterData = (() => {
    if (selectedProductId) return [];
    const outByProduct = new Map<string, number>();
    for (const m of movements) {
      if (m.type !== 'out') continue;
      const pid = m.variant?.product?.id ?? '';
      outByProduct.set(pid, (outByProduct.get(pid) ?? 0) + m.quantity);
    }
    return productStocks.map((ps) => ({
      name:   ps.name,
      x:      outByProduct.get(ps.id) ?? 0,
      y:      ps.stock,
      z:      Math.max(ps.value / 1000, 10),
      margin: ps.price - ps.cost,
    }));
  })();

  const avgSales = scatterData.length ? scatterData.reduce((s, d) => s + d.x, 0) / scatterData.length : 0;
  const avgStock = scatterData.length ? scatterData.reduce((s, d) => s + d.y, 0) / scatterData.length : 0;

  // ── Heatmap tallas ───────────────────────────────────────────────────────
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

  // ── Por producto / talla ─────────────────────────────────────────────────
  const productData = (() => {
    if (selectedProductId) return [];
    const map = new Map<string, { in: number; out: number }>();
    for (const m of movements) {
      const name      = m.variant?.product?.name ?? 'Desconocido';
      const fullPrice = m.variant?.product?.price ?? 0;
      const unitPrice = m.type === 'out' ? (m.sale_price ?? fullPrice) : fullPrice;
      const val       = metric === 'qty' ? m.quantity : m.quantity * unitPrice;
      const entry = map.get(name) ?? { in: 0, out: 0 };
      if (m.type === 'in') entry.in += val; else entry.out += val;
      map.set(name, entry);
    }
    return [...map.entries()]
      .map(([name, v]) => ({
        name:     name.length > 16 ? name.slice(0, 14) + '…' : name,
        Entradas: Math.round(v.in  * 100) / 100,
        Salidas:  Math.round(v.out * 100) / 100,
      }))
      .sort((a, b) => b.Salidas - a.Salidas);
  })();

  const sizeMovementData = (() => {
    if (!selectedProductId) return [];
    const map = new Map<string, { in: number; out: number }>();
    for (const m of filteredMovements) {
      const size  = m.variant?.size ?? '?';
      const price = m.variant?.product?.price ?? 0;
      const val   = metric === 'qty' ? m.quantity : m.quantity * price;
      const entry = map.get(size) ?? { in: 0, out: 0 };
      if (m.type === 'in') entry.in += val; else entry.out += val;
      map.set(size, entry);
    }
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        Entradas: Math.round(v.in  * 100) / 100,
        Salidas:  Math.round(v.out * 100) / 100,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const stockChartData = selectedProduct
    ? selectedProduct.variants
        .sort((a, b) => a.size.localeCompare(b.size))
        .map((v) => ({
          name:  v.size,
          Stock: metric === 'value' ? Math.round(v.current_stock * selectedProduct.price) : v.current_stock,
        }))
    : productStocks.map((p) => ({
        name:  p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name,
        Stock: metric === 'value' ? Math.round(p.value) : p.stock,
      }));

  const tooltipFmt = (value: number | string) => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return metric === 'value' ? fmt(n) : `${n} u.`;
  };
  const yFmt = (v: number) => metric === 'value' ? `$${(v / 1000).toFixed(0)}k` : String(v);

  const cardBase = 'bg-white rounded-2xl shadow-sm border border-gray-100 p-6';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analíticas</h1>
        <p className="text-gray-400 mt-1 text-sm">Visualiza el comportamiento de tu inventario</p>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Producto</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
          >
            <option value="">Todos los productos</option>
            {productList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                period === p.value
                  ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setMetric('value')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${metric === 'value' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Valor ($)
          </button>
          <button
            onClick={() => setMetric('qty')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${metric === 'qty' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Unidades
          </button>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${chartType === 'line' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Línea
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${chartType === 'bar' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Barras
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 -mt-2">
        Datos confirmados hasta ayer · Los movimientos de hoy se consolidan a medianoche
      </p>

      {selectedProduct && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
          <div>
            <span className="text-sm font-bold text-indigo-900">{selectedProduct.name}</span>
            <span className="text-sm text-indigo-400 ml-2">
              Stock: {selectedProduct.stock} u. · Valor: {fmt(selectedProduct.value)}
            </span>
          </div>
          <button
            onClick={() => setSelectedProductId('')}
            className="ml-auto text-xs text-indigo-400 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            Ver todos
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Salidas en período"
              value={`${totalOutQty} u.`}
              sub={`Entradas: ${totalInQty} u.`}
              gradient="bg-gradient-to-br from-indigo-500 to-violet-600"
              delta={deltaSalidas !== null ? { value: deltaSalidas, label: 'vs período ant.' } : undefined}
            />
            <KpiCard
              label="Rotación"
              value={rotacion !== null ? `${rotacion.toFixed(2)}x` : '—'}
              sub={rotacion !== null ? (rotacion >= 1 ? 'Buen ritmo' : 'Stock lento') : 'Sin stock'}
              gradient={rotacion !== null && rotacion >= 1
                ? 'bg-gradient-to-br from-emerald-400 to-teal-600'
                : 'bg-gradient-to-br from-amber-400 to-orange-500'}
            />
            <KpiCard
              label="Días de inventario"
              value={diasInventario !== null ? `${diasInventario} días` : '—'}
              sub={diasInventario !== null ? (diasInventario <= 30 ? 'Restock pronto' : 'Stock suficiente') : 'Sin ventas'}
              gradient={diasInventario !== null && diasInventario <= 30
                ? 'bg-gradient-to-br from-rose-400 to-pink-600'
                : 'bg-gradient-to-br from-sky-400 to-cyan-600'}
            />
            <KpiCard
              label="% Vendido"
              value={currentStock + totalOutQty > 0
                ? `${Math.round((totalOutQty / (currentStock + totalOutQty)) * 100)}%`
                : '—'}
              sub="del inventario disponible"
              gradient="bg-gradient-to-br from-fuchsia-500 to-purple-700"
            />
          </div>

          {/* ── Time series ── */}
          <div className={cardBase}>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Movimientos en el tiempo
              {selectedProduct ? ` — ${selectedProduct.name}` : ''} · {metric === 'value' ? 'Valor ($)' : 'Unidades'}
            </h2>
            {timeData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-300 text-sm">
                No hay movimientos en el período seleccionado
              </div>
            ) : chartType === 'line' ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={yFmt} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                  <Legend iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="Entradas" stroke={IN_COLOR}  strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: IN_COLOR }} />
                  <Line type="monotone" dataKey="Salidas"  stroke={OUT_COLOR} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: OUT_COLOR }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={yFmt} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="Entradas" fill={IN_COLOR}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Salidas"  fill={OUT_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Evolución del stock ── */}
          {stockEvolutionData.length > 0 && (
            <div className={cardBase}>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">
                Evolución del stock{selectedProduct ? ` — ${selectedProduct.name}` : ''} · Unidades
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                Stock acumulado a lo largo del período — parte del stock inicial y sube o baja con cada movimiento.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stockEvolutionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip
                    formatter={((v: number) => [`${v} u.`, 'Stock']) as any}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Stock"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#6366f1' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Análisis ABC ── */}
          {!selectedProductId && abcData.length > 0 && (
            <div className={cardBase}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-700">Análisis ABC — Concentración de ventas</h2>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />A</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />B</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />C</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-5">Los productos A generan el 80% del volumen — prioriza su restock.</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={abcData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload }: any) =>
                      active && payload?.length ? (
                        <div className="bg-white border-0 rounded-xl shadow-xl p-3 text-sm">
                          <p className="font-bold text-gray-800">{payload[0].payload.name}</p>
                          <p className="text-gray-400">Ventas: <span className="font-semibold text-gray-700">{payload[0].value} u.</span></p>
                          <p className="text-gray-400">% acumulado: <span className="font-semibold text-gray-700">{payload[0].payload.pctAcum}%</span></p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold text-white ${payload[0].payload.clase === 'A' ? 'bg-emerald-400' : payload[0].payload.clase === 'B' ? 'bg-amber-400' : 'bg-slate-400'}`}>
                            Clase {payload[0].payload.clase}
                          </span>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="Ventas" radius={[6, 6, 0, 0]}>
                    {abcData.map((entry, i) => (
                      <Cell key={i} fill={ABC_COLORS[entry.clase as keyof typeof ABC_COLORS]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Scatter stock vs ventas ── */}
          {!selectedProductId && scatterData.length > 1 && (
            <div className={cardBase}>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Stock actual vs Ventas del período</h2>
              <p className="text-xs text-gray-400 mb-4">Las líneas punteadas marcan el promedio de cada eje.</p>
              <div className="grid grid-cols-2 gap-2 text-xs mb-5">
                {[
                  { dir: '↑←', label: 'Capital inmovilizado', sub: 'mucho stock, pocas ventas', bg: 'bg-indigo-50', text: 'text-indigo-500' },
                  { dir: '↑→', label: 'Estrella', sub: 'alto stock y altas ventas', bg: 'bg-emerald-50', text: 'text-emerald-500' },
                  { dir: '↓←', label: 'Lento / Obsoleto', sub: 'bajo stock y bajas ventas', bg: 'bg-gray-50', text: 'text-gray-400' },
                  { dir: '↓→', label: 'Riesgo de quiebre', sub: 'altas ventas, bajo stock', bg: 'bg-rose-50', text: 'text-rose-500' },
                ].map(({ dir, label, sub, bg, text }) => (
                  <div key={dir} className={`flex items-center gap-2 p-2.5 ${bg} rounded-xl`}>
                    <span className={`font-bold text-base ${text}`}>{dir}</span>
                    <span className="text-gray-500"><span className="font-semibold">{label}</span> — {sub}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    type="number" dataKey="x" name="Ventas"
                    tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    label={{ value: 'Ventas (u.)', position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: '#9ca3af' } }}
                  />
                  <YAxis
                    type="number" dataKey="y" name="Stock"
                    tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    label={{ value: 'Stock actual (u.)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' }, dx: 12 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[50, 500]} />
                  <Tooltip content={<ScatterTooltipContent />} />
                  {avgSales > 0 && <ReferenceLine x={avgSales} stroke="#c7d2fe" strokeDasharray="5 5" strokeWidth={2} />}
                  {avgStock > 0 && <ReferenceLine y={avgStock} stroke="#c7d2fe" strokeDasharray="5 5" strokeWidth={2} />}
                  <Scatter data={scatterData} fillOpacity={0.85}>
                    {scatterData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Heatmap de tallas ── */}
          {sizeHeatData.length > 0 && (
            <div className={cardBase}>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">
                Salidas por talla{selectedProduct ? ` — ${selectedProduct.name}` : ''}
              </h2>
              <p className="text-xs text-gray-400 mb-5">Qué tallas salen más — optimiza tus compras.</p>
              <div className="space-y-2.5">
                {sizeHeatData.map((item, i) => (
                  <div key={item.size} className="flex items-center gap-3">
                    <span className="w-10 text-sm font-semibold text-gray-600 text-right">{item.size}</span>
                    <div className="flex-1 h-8 bg-gray-100 rounded-xl overflow-hidden">
                      <div
                        className="h-full rounded-xl flex items-center px-3 transition-all duration-700"
                        style={{
                          width:      `${Math.max(item.pct, 5)}%`,
                          background: PALETTE[i % PALETTE.length],
                          opacity:    0.85 + (item.pct / 100) * 0.15,
                        }}
                      >
                        <span className="text-white text-xs font-bold">{item.qty} u.</span>
                      </div>
                    </div>
                    <span className="w-10 text-xs text-gray-400 font-medium">{item.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Movimientos por talla (producto seleccionado) ── */}
          {selectedProductId && sizeMovementData.length > 0 && (
            <div className={cardBase}>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Movimientos por talla · {metric === 'value' ? 'Valor ($)' : 'Unidades'}
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sizeMovementData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={yFmt} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="Entradas" fill={IN_COLOR}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Salidas"  fill={OUT_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Movimientos por producto ── */}
          {!selectedProductId && productData.length > 0 && (
            <div className={cardBase}>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Movimientos por producto · {metric === 'value' ? 'Valor ($)' : 'Unidades'}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={yFmt} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="Entradas" fill={IN_COLOR}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Salidas"  fill={OUT_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Stock actual ── */}
          {stockChartData.length > 0 && (
            <div className={cardBase}>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                {selectedProduct ? `Stock actual por talla — ${selectedProduct.name}` : 'Stock actual por producto'}
                {' '}· {metric === 'value' ? 'Valor ($)' : 'Unidades'}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stockChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: selectedProduct ? 12 : 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={yFmt} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={tooltipFmt as any} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="Stock" radius={[4, 4, 0, 0]}>
                    {stockChartData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
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
