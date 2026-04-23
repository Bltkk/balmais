'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { VendorPayment } from '@/types/database';

const fmt = (n: number) =>
  n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

function startOf(unit: 'week' | 'month' | 'year') {
  const d = new Date();
  if (unit === 'week') { d.setDate(d.getDate() - 6); }
  else if (unit === 'month') { d.setDate(1); }
  else { d.setMonth(0, 1); }
  d.setHours(0, 0, 0, 0);
  return d;
}

interface OutMovement {
  id: string;
  quantity: number;
  commission: number;
  notes: string | null;
  created_at: string;
  variant: { size: string; product: { name: string; code: string; comision: number } } | null;
}

type ViewMode = 'pending' | 'custom';

export default function VendedorPage() {
  const [movements, setMovements] = useState<OutMovement[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  const [dateFrom, setDateFrom] = useState(toInputDate(startOf('month')));
  const [dateTo, setDateTo] = useState(toInputDate(new Date()));

  const [editRow, setEditRow] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);
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
        .select('id, quantity, commission, notes, created_at, variant:product_variants(size, product:products(name, code, comision))')
        .eq('user_id', user.id)
        .eq('type', 'out')
        .order('created_at', { ascending: false }),
    ]);

    setPayments((pays as VendorPayment[]) || []);
    setMovements((movs as unknown as OutMovement[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (editRow) editRef.current?.focus(); }, [editRow]);

  const lastPayment = payments[0] ?? null;
  const pendingFrom = lastPayment ? new Date(lastPayment.period_to) : null;

  const effComm = (m: OutMovement) =>
    m.commission > 0 ? m.commission : (m.variant?.product?.comision ?? 0) * m.quantity;

  const pendingMovements = movements.filter((m) =>
    pendingFrom ? new Date(m.created_at) > pendingFrom : true
  );
  const pendingTotal = pendingMovements.reduce((s, m) => s + effComm(m), 0);

  const visible = viewMode === 'pending'
    ? pendingMovements
    : movements.filter((m) => {
        const from = new Date(dateFrom + 'T00:00:00');
        const to = new Date(dateTo + 'T23:59:59');
        return new Date(m.created_at) >= from && new Date(m.created_at) <= to;
      });

  const totalComision = visible.reduce((s, m) => s + effComm(m), 0);
  const totalUnits = visible.reduce((s, m) => s + m.quantity, 0);

  const startEdit = (m: OutMovement) => {
    setEditRow(m.id);
    setEditVal(String(effComm(m)));
  };

  const saveCommission = async (id: string) => {
    const val = Math.min(Math.max(parseInt(editVal) || 0, 0), 2_000_000_000);
    setSaving(id);
    await supabase.from('stock_movements').update({ commission: val }).eq('id', id);
    setEditRow(null);
    setSaving(null);
    load();
  };

  const handlePay = async () => {
    const amount = pendingTotal;
    if (amount === 0 && !confirm('La comisión pendiente es $0. ¿Registrar igual?')) return;
    setPaying(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPaying(false); return; }
    const now = new Date().toISOString();
    const { error } = await supabase.from('vendor_payments').insert({
      amount,
      period_from: pendingFrom?.toISOString() ?? new Date(0).toISOString(),
      period_to: now,
      notes: payNotes || null,
      user_id: user.id,
    });
    if (!error) { setShowPayModal(false); setPayNotes(''); load(); }
    setPaying(false);
  };

  const handleDeletePayment = async (id: string) => {
    await supabase.from('vendor_payments').delete().eq('id', id);
    setDeleteConfirm(null);
    load();
  };

  const setQuickRange = (unit: 'week' | 'month' | 'year') => {
    setDateFrom(toInputDate(startOf(unit)));
    setDateTo(toInputDate(new Date()));
    setViewMode('custom');
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedor</h1>
          <p className="text-gray-500 mt-1">Seguimiento de comisiones y pagos</p>
        </div>
        <button
          onClick={() => setShowPayModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 shadow-sm whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Registrar pago
        </button>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pendiente de pago</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{fmt(pendingTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">
            desde {pendingFrom ? fmtDate(pendingFrom.toISOString()) : 'el inicio'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vista actual</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(totalComision)}</p>
          <p className="text-xs text-gray-400 mt-1">{visible.length} movimientos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unidades vendidas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalUnits.toLocaleString('es-CL')}</p>
          <p className="text-xs text-gray-400 mt-1">en la vista actual</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Último pago</p>
          {lastPayment ? (
            <>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(lastPayment.amount)}</p>
              <p className="text-xs text-gray-400 mt-1">{fmtDate(lastPayment.created_at)}</p>
            </>
          ) : (
            <p className="text-lg font-semibold text-gray-300 mt-1">Sin pagos</p>
          )}
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg shrink-0">
            <button
              onClick={() => setViewMode('pending')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'pending' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pendiente de pago
            </button>
            <button
              onClick={() => setViewMode('custom')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'custom' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Por fecha
            </button>
          </div>

          {/* Date controls */}
          {viewMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="date" value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
                <span className="text-gray-400 text-sm">→</span>
                <input
                  type="date" value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div className="flex gap-1">
                {(['week', 'month', 'year'] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setQuickRange(u)}
                    className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 transition-colors"
                  >
                    {{ week: 'Semana', month: 'Mes', year: 'Año' }[u]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'pending' && pendingFrom && (
            <p className="text-sm text-gray-400">
              Desde el último pago: <span className="text-gray-600 font-medium">{fmtDate(pendingFrom.toISOString())}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Movements table ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              {viewMode === 'pending' ? 'Ventas pendientes de pago' : 'Ventas en el período'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Hacé clic en el lápiz para editar la comisión de un movimiento
            </p>
          </div>
          {totalComision > 0 && (
            <span className="text-sm font-bold text-purple-700">{fmt(totalComision)}</span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">Sin movimientos en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Talla</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unid.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((m) => {
                  const isEditing = editRow === m.id;
                  const stored = m.commission > 0;
                  const calculated = effComm(m);
                  const hasNoCommission = calculated === 0;

                  return (
                    <tr key={m.id} className={`hover:bg-gray-50 ${!stored && !hasNoCommission ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDateTime(m.created_at)}</td>
                      <td className="px-6 py-3">
                        <span className="font-medium text-gray-900">{m.variant?.product?.name ?? '—'}</span>
                        <span className="ml-2 text-xs text-gray-400">{m.variant?.product?.code}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold text-gray-700">
                          {m.variant?.size ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{m.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 text-xs">$</span>
                            <input
                              ref={editRef}
                              type="number" min="0" step="100"
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCommission(m.id);
                                if (e.key === 'Escape') setEditRow(null);
                              }}
                              className="w-24 px-2 py-1 text-right text-sm border border-purple-400 rounded-lg focus:ring-2 focus:ring-purple-400"
                            />
                            <button
                              onClick={() => saveCommission(m.id)}
                              disabled={saving === m.id}
                              className="px-2 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                              {saving === m.id ? '…' : '✓'}
                            </button>
                            <button onClick={() => setEditRow(null)} className="px-1 py-1 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {hasNoCommission ? (
                              <span className="text-gray-300 text-sm">—</span>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-purple-700">{fmt(calculated)}</span>
                                {!stored && (
                                  <span className="text-xs text-amber-500">del producto</span>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => startEdit(m)}
                              title="Editar comisión"
                              className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-400 text-xs">{m.notes ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="px-6 py-3 font-semibold text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalUnits}</td>
                  <td className="px-4 py-3 text-right font-bold text-purple-700 text-base">{fmt(totalComision)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Payment history ────────────────────────────────────── */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Historial de pagos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período cubierto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto pagado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-700 whitespace-nowrap font-medium">{fmtDate(p.created_at)}</td>
                    <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-gray-100 rounded">
                        {fmtDate(p.period_from)} → {fmtDate(p.period_to)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(p.amount)}</td>
                    <td className="px-6 py-3 text-gray-400 text-xs">{p.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {deleteConfirm === p.id ? (
                        <span className="flex items-center gap-2 justify-end">
                          <button onClick={() => handleDeletePayment(p.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Eliminar</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 hover:text-gray-600">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(p.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pay modal ──────────────────────────────────────────── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Registrar pago</h2>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 mb-5 text-center">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Monto pendiente</p>
              <p className="text-4xl font-bold text-purple-800">{fmt(pendingTotal)}</p>
              <p className="text-xs text-purple-500 mt-2">
                {pendingMovements.length} movimientos · {pendingMovements.reduce((s, m) => s + m.quantity, 0)} unidades
              </p>
              {pendingFrom && (
                <p className="text-xs text-purple-400 mt-1">
                  desde {fmtDate(pendingFrom.toISOString())}
                </p>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nota del pago</label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="ej. Pago semana 15–21 abr"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 text-sm"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm"
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
