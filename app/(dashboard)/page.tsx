'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface RecentProduct {
  code: string;
  name: string;
  stock: number;
  price: number;
}

interface RecentMovement {
  id: string;
  type: 'in' | 'out';
  product: string;
  size: string;
  quantity: number;
  date: string;
}

export default function DashboardPage() {
  const [totals, setTotals] = useState({ products: 0, stock: 0, value: 0, todayMovements: 0 });
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: products } = await supabase
      .from('products')
      .select('code, name, price, created_at, variants:product_variants(current_stock)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const list = (products || []) as Array<{
      code: string;
      name: string;
      price: number;
      created_at: string;
      variants: { current_stock: number }[];
    }>;

    const totalStockPerProduct = list.map((p) => ({
      ...p,
      stock: p.variants.reduce((s, v) => s + v.current_stock, 0),
    }));

    const stock = totalStockPerProduct.reduce((sum, p) => sum + p.stock, 0);
    const value = totalStockPerProduct.reduce((sum, p) => sum + p.price * p.stock, 0);

    setTotals((prev) => ({ ...prev, products: list.length, stock, value }));
    setRecentProducts(
      totalStockPerProduct.slice(0, 5).map((p) => ({ code: p.code, name: p.name, stock: p.stock, price: p.price }))
    );

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: movements, count: todayCount } = await supabase
      .from('stock_movements')
      .select('id, type, quantity, created_at, variant:product_variants(size, product:products(name))', {
        count: 'exact',
      })
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    setTotals((prev) => ({ ...prev, todayMovements: todayCount || 0 }));
    setRecentMovements(
      (movements || []).map((m: any) => ({
        id: m.id,
        type: m.type,
        product: m.variant?.product?.name || '—',
        size: m.variant?.size || '',
        quantity: m.quantity,
        date: new Date(m.created_at).toLocaleString('es'),
      }))
    );
  };

  const stats = [
    { label: 'Total Productos', value: totals.products.toString(), icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'bg-blue-500' },
    { label: 'Stock Total', value: totals.stock.toString(), icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', color: 'bg-green-500' },
    { label: 'Valor Inventario', value: `$${totals.value.toFixed(2)}`, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-yellow-500' },
    { label: 'Movimientos Hoy', value: totals.todayMovements.toString(), icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Resumen de tu inventario</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/products/new" className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
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
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Ver Productos</p>
              <p className="text-sm text-gray-500">Stock por talla</p>
            </div>
          </Link>
          <Link href="/reports" className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Reportes</p>
              <p className="text-sm text-gray-500">Ver movimientos</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Productos Recientes</h2>
            <Link href="/products" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ver todos →</Link>
          </div>
          <div className="p-6">
            {recentProducts.length > 0 ? (
              <div className="space-y-4">
                {recentProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{product.stock} unidades</p>
                      <p className="text-sm text-gray-500">${product.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No hay productos aún</p>
                <Link href="/products/new" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Crear primer producto →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Movimientos Recientes</h2>
            <Link href="/reports" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ver todos →</Link>
          </div>
          <div className="p-6">
            {recentMovements.length > 0 ? (
              <div className="space-y-4">
                {recentMovements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${movement.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                        <span className={`text-sm ${movement.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                          {movement.type === 'in' ? '↓' : '↑'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {movement.product} <span className="text-gray-500 text-xs">· {movement.size}</span>
                        </p>
                        <p className="text-sm text-gray-500">{movement.date}</p>
                      </div>
                    </div>
                    <span className={`font-medium ${movement.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                      {movement.type === 'in' ? '+' : '-'}{movement.quantity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay movimientos aún</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
