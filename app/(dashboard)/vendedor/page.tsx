'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { VendorPayment } from '@/types/database';

const fmt = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

interface OutMovement {
  id: string;
  quantity: number;
  commission: number;
  notes: string | null;
  created_at: string;
  variant: { size: string; product: { name: string; code: string } } | null;
}

export default function VendedorPage() {
  const [movements, setMovements] = useState<OutMovement[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payNotes, setPayNotes] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: pays }, { data: movs }] = await Promise.all([
      supabase
        .from('vendor_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('stock_movements')
        .select('id, quantity, commission, notes, created_at, variant:product_variants(size, product:products(name, code))')
        .eq('user_id', user.id)
        .eq('type', 'out')
        .order('created_at', { ascending: false }),
    ]);

    setPayments((pays as VendorPayment[]) || []);
    setMovements((movs as unknown as OutMovement[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const lastPayment = payments[0] ?? null;
  const periodFrom = lastPayment ? new Date(lastPayment.period_to) : null;

  const pending = movements.filter((m) =>
    periodFrom ? new Date(m.created_at) > periodFrom : true
  );

  const pendingTotal = pending.reduce((s, m) => s + m.commission, 0);
  const pendingUnits = pending.reduce((s, m) => s + m.quantity, 0);

  const handlePay = async () => {
    if (pendingTotal === 0) return;
    setPaying(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPaying(false); return; }

    const now = new Date().toISOString();
    const { error } = await supabase.from('vendor_payments').insert({
      amount: pendingTotal,
      period_from: periodFrom?.toISOString() ?? new Date(0).toISOString(),
      period_to: now,
      notes: payNotes || null,
      user_id: user.id,
    });

    if (!error) {
      setShowPayModal(false);
      setPayNotes('');
      load();
    }
    setPaying(false);
  };

  const handleDeletePayment = async (id: string) => {
    await supabase.from('vendor_payments').delete().eq('id', id);
    setDeleteConfirm(null);
    load();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedor</h1>
          <p className="text-gray-500 mt-1">
            Comisiones acumuladas desde ventas registradas
          </p>
        </div>
        {pendingTotal > 0 && (
          <button
            onClick={() => setShowPayModal(true)}
            className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 shadow-sm"
          >
            Registrar pago
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Comisión pendiente</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{fmt(pendingTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{pendingUnits} unidades vendidas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Período desde</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {periodFrom ? formatDate(periodFrom.toISOString()) : 'Inicio'}
          </p>
          <p className="text-xs text-gray-400 mt-1">hasta hoy</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Último pago</p>
          {lastPayment ? (
            <>
              <p className="text-lg font-semibold text-gray-900 mt-1">{fmt(lastPayment.amount)}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(lastPayment.created_at)}</p>
            </>
          ) : (
            <p className="text-lg font-semibold text-gray-400 mt-1">Sin pagos aún</p>
          )}
        </div>
      </div>

      {/* Pending movements */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Ventas pendientes de pago</h2>
          {pendingTotal > 0 && (
            <span className="text-sm font-semibold text-purple-700">{fmt(pendingTotal)}</span>
          )}
        </div>
        {loading ? (
          <div className="text-center py-12">
            <div className="w-7 h-7 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No hay ventas pendientes de pago</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Talla</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unidades</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                    <td className="px-6 py-3">
                      <span className="font-medium text-gray-900">{m.variant?.product?.name ?? '—'}</span>
                      <span className="ml-2 text-xs text-gray-400">{m.variant?.product?.code}</span>
                    </td>
                    <td className="px-6 py-3 text-gray-700 font-medium">{m.variant?.size ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{m.quantity}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.commission > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
                      {m.commission > 0 ? fmt(m.commission) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="px-6 py-3 font-semibold text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{pendingUnits}</td>
                  <td className="px-4 py-3 text-right font-bold text-purple-700">{fmt(pendingTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Historial de pagos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período cubierto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-700 whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(p.period_from)} → {formatDate(p.period_to)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(p.amount)}</td>
                    <td className="px-6 py-3 text-gray-500 text-xs">{p.notes ?? ''}</td>
                    <td className="px-4 py-3 text-right">
                      {deleteConfirm === p.id ? (
                        <span className="flex items-center gap-2 justify-end">
                          <button onClick={() => handleDeletePayment(p.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Confirmar</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(p.id)} className="text-xs text-gray-400 hover:text-red-500">Eliminar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Registrar pago</h2>
            <p className="text-sm text-gray-500 mb-5">
              Esto marcará {pending.length} venta{pending.length !== 1 ? 's' : ''} como pagadas.
            </p>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5 text-center">
              <p className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Monto a pagar</p>
              <p className="text-3xl font-bold text-purple-800">{fmt(pendingTotal)}</p>
              <p className="text-xs text-purple-500 mt-1">{pendingUnits} unidades · {pending.length} movimientos</p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nota (opcional)</label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="ej. Pago semana 15-21 abr"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {paying ? 'Registrando…' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
