'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category, ProductWithVariants } from '@/types/database';

const fmt = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const fmtPct = (n: number) => `${Math.round(n)}%`;

function totalStock(p: ProductWithVariants) {
  return p.variants.reduce((s, v) => s + v.current_stock, 0);
}

interface ProductCalc {
  product: ProductWithVariants;
  stock: number;
  price: number;
  ivaUnit: number;
  cost: number;
  commission: number;
  marginUnit: number;
  totalRevenue: number;
  totalIva: number;
  totalCost: number;
  totalCommission: number;
  totalReturn: number;
  marginPct: number;
}

export default function RetornoPage() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [scope, setScope] = useState<'all' | 'category' | 'product'>('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');

  const [applyIva, setApplyIva] = useState(true);
  const [ivaRate, setIvaRate] = useState(19);

  const [globalCommission, setGlobalCommission] = useState(1500);
  const [commissions, setCommissions] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase
        .from('products')
        .select('*, variants:product_variants(*), category:categories(id,name,color)')
        .eq('user_id', user.id)
        .order('name'),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    ]);

    setProducts((prods as unknown as ProductWithVariants[]) || []);
    setCategories(cats || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getCommission = (productId: string) => {
    const val = commissions[productId];
    return val !== undefined ? (parseInt(val) || 0) : globalCommission;
  };

  // Precios ingresados SIN IVA → IVA = precio × tasa (se suma como costo)
  const calcProduct = (product: ProductWithVariants): ProductCalc => {
    const stock = totalStock(product);
    const price = product.price;
    const cost = product.cost ?? 0;
    const commission = getCommission(product.id);
    const ivaUnit = applyIva ? Math.round(price * ivaRate / 100) : 0;
    const marginUnit = price - ivaUnit - cost - commission;
    const marginPct = price > 0 ? (marginUnit / price) * 100 : 0;

    return {
      product,
      stock,
      price,
      ivaUnit,
      cost,
      commission,
      marginUnit,
      totalRevenue: price * stock,
      totalIva: ivaUnit * stock,
      totalCost: cost * stock,
      totalCommission: commission * stock,
      totalReturn: marginUnit * stock,
      marginPct,
    };
  };

  const filtered = products
    .filter((p) => {
      if (scope === 'category') return selectedCategory ? p.category_id === selectedCategory : true;
      if (scope === 'product') return selectedProduct ? p.id === selectedProduct : true;
      return true;
    })
    .filter((p) => totalStock(p) > 0);

  const rows = filtered.map(calcProduct);

  const totals = rows.reduce(
    (acc, r) => ({
      stock: acc.stock + r.stock,
      revenue: acc.revenue + r.totalRevenue,
      iva: acc.iva + r.totalIva,
      cost: acc.cost + r.totalCost,
      commission: acc.commission + r.totalCommission,
      ret: acc.ret + r.totalReturn,
    }),
    { stock: 0, revenue: 0, iva: 0, cost: 0, commission: 0, ret: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calculadora de Retorno</h1>
        <p className="text-gray-500 mt-1">
          Precios ingresados <strong>sin IVA</strong> — el IVA se calcula sobre el precio y se descuenta como costo
        </p>
      </div>

      {/* Config panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Scope */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alcance</p>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {([['all', 'Todo'], ['category', 'Categoría'], ['product', 'Producto']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setScope(v)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  scope === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {scope === 'category' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {scope === 'product' && (
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            >
              <option value="">Todos los productos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* IVA */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">IVA sobre ventas</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setApplyIva(!applyIva)}
              className={`relative w-10 h-6 rounded-full transition-colors ${applyIva ? 'bg-slate-900' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${applyIva ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-sm text-gray-700">Descontar IVA del retorno</span>
          </label>
          {applyIva && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Tasa</label>
              <div className="relative flex-1">
                <input
                  type="number" min="0" max="100" step="1"
                  value={ivaRate}
                  onChange={(e) => setIvaRate(parseInt(e.target.value) || 0)}
                  className="w-full pr-8 pl-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400">
            IVA = precio × {ivaRate}% = {fmt(Math.round(10000 * ivaRate / 100))} por cada $10.000 de precio
          </p>
        </div>

        {/* Commission */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comisión base de vendedor</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number" min="0" step="100"
              value={globalCommission}
              onChange={(e) => setGlobalCommission(parseInt(e.target.value) || 0)}
              className="w-full pl-8 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <p className="text-xs text-gray-400">
            Por unidad vendida. Podés ajustar individualmente en la tabla (varía entre $1.000 y $2.000).
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Unidades', value: totals.stock.toLocaleString('es-CL'), color: 'bg-blue-500' },
            { label: 'Ingresos brutos', value: fmt(totals.revenue), color: 'bg-indigo-500' },
            ...(applyIva ? [{ label: `IVA (${ivaRate}%)`, value: fmt(totals.iva), color: 'bg-orange-400' }] : []),
            { label: 'Costos + comis.', value: fmt(totals.cost + totals.commission), color: 'bg-red-400' },
            { label: 'Retorno neto', value: fmt(totals.ret), color: totals.ret >= 0 ? 'bg-emerald-500' : 'bg-red-500' },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5 truncate">{c.value}</p>
              <div className={`mt-2 h-1 rounded-full ${c.color} opacity-60`} />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-500">No hay productos con stock para el filtro seleccionado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">P. venta (neto)</th>
                  {applyIva && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-orange-500 uppercase tracking-wider">IVA /u</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Comisión /u</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Margen /u</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Retorno total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.product.id} className={`hover:bg-gray-50 ${r.marginUnit < 0 ? 'bg-red-50/50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{r.product.name}</span>
                        <span className="text-xs text-gray-400">{r.product.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.stock}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(r.price)}</td>
                    {applyIva && (
                      <td className="px-4 py-3 text-right text-orange-600 font-medium">−{fmt(r.ivaUnit)}</td>
                    )}
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(r.cost)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-flex items-center">
                        <span className="absolute left-2 text-gray-400 text-xs">$</span>
                        <input
                          type="number" min="0" step="100"
                          value={commissions[r.product.id] ?? globalCommission}
                          onChange={(e) =>
                            setCommissions((prev) => ({ ...prev, [r.product.id]: e.target.value }))
                          }
                          className="w-28 pl-5 pr-2 py-1 text-right text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${r.marginUnit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt(r.marginUnit)}
                      <span className="ml-1 text-xs opacity-70">({fmtPct(r.marginPct)})</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.totalReturn >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt(r.totalReturn)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td className="px-5 py-3 font-semibold text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{totals.stock.toLocaleString('es-CL')}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(totals.revenue)}</td>
                  {applyIva && (
                    <td className="px-4 py-3 text-right font-medium text-orange-600">−{fmt(totals.iva)}</td>
                  )}
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(totals.cost)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(totals.commission)}</td>
                  <td className="px-4 py-3" />
                  <td className={`px-4 py-3 text-right font-bold text-base ${totals.ret >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmt(totals.ret)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Formula explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">Fórmula aplicada</p>
        <p>
          <strong>Margen/u</strong> = Precio − IVA ({ivaRate}%) − Costo − Comisión
        </p>
        <p>
          <strong>Retorno total</strong> = Margen/u × Stock disponible
        </p>
        <p className="text-blue-500 text-xs mt-1">
          Los precios se toman tal como están ingresados (sin IVA). El IVA se descuenta como obligación fiscal sobre la venta.
          Ajustá la comisión por producto directamente en la tabla.
        </p>
      </div>
    </div>
  );
}
