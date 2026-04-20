'use client';

import { useState } from 'react';
import { supabase, setAuthCookie } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Credenciales inválidas');
      setLoading(false);
      return;
    }

    setAuthCookie();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-col justify-center items-center p-12">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">Control Total</h1>
          <p className="text-slate-400 text-base max-w-sm mx-auto">
            Gestiona productos, controla el stock y conoce el valor de tu inventario en tiempo real
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 text-left">
          {[
            { title: 'Gestión de Productos', desc: 'Crea, edita y elimina productos fácilmente' },
            { title: 'Control de Stock', desc: 'Registra entradas y salidas por talla' },
            { title: 'Valor de Inventario', desc: 'Calcula el valor total en tiempo real' },
          ].map((feature, i) => (
            <div key={i} className="flex items-start gap-4 text-white">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
              <div>
                <p className="font-semibold">{feature.title}</p>
                <p className="text-sm text-slate-400">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Control Total</h1>
            <p className="text-sm text-gray-400 mt-1">by Tracta</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Bienvenido</h2>
            <p className="text-gray-500 mb-8">Ingresa tus credenciales para continuar</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            © 2026 by Tracta
          </p>
        </div>
      </div>
    </div>
  );
}
