# Auditoría de seguridad y guía de hosting

_Fecha: 2026-04-19 · Stack: Next.js 14 (App Router) + Supabase_

---

## 1. Modelo de amenazas (resumen)

La app es mono-tenant por usuario: cada persona autenticada ve y
modifica sólo sus propios productos, variantes y movimientos. La
superficie crítica es:

- Postgres de Supabase (datos de inventario, `auth.users`).
- Claves públicas `NEXT_PUBLIC_SUPABASE_*` que viajan al cliente.
- La cookie marcador `sb-auth` (no-httpOnly) que usa el middleware.
- Sesión de Supabase persistida en `localStorage` del navegador.

Los usuarios son, en principio, empleados de la tienda (no hostiles).
Aun así, la defensa real contra acceso cruzado está en las **RLS
policies** de Postgres, no en la UI.

---

## 2. Hallazgos

### 🔴 Críticos

| # | Hallazgo | Impacto | Mitigación |
|---|----------|---------|------------|
| C1 | `.env.local` **tiene credenciales reales** y está en el repo de trabajo | Si se commitea al remoto, el `anon key` queda público. El `anon key` no es secreto en sí (se expone al browser), pero la URL + key permiten enumerar proyectos. | `.gitignore` ya cubre `.env*.local`. Verificar con `git status` antes de commit. **Rotar la `anon key`** en Supabase ahora si ya hiciste push. |
| C2 | **No existe confirmación de email** ni validación de dominio al registrar usuarios | Cualquiera con acceso a Supabase puede crear usuarios que vean sus propios datos (no los tuyos — RLS protege). Si habilitas signup público, potencial abuso de storage gratis. | En Supabase → Authentication → Providers → Email: desactivar "Enable email signups" si sólo vos creás usuarios desde el panel. |

### 🟠 Altos

| # | Hallazgo | Impacto | Mitigación |
|---|----------|---------|------------|
| H1 | Sesión de Supabase en `localStorage` | Vulnerable a XSS: si un atacante logra ejecutar JS en el dominio, roba la sesión. Mitigado porque no hay inputs que rendericen HTML crudo. | Mantener la disciplina de no usar `dangerouslySetInnerHTML`. Considerar migrar a `@supabase/ssr` con cookies httpOnly si el riesgo sube. |
| H2 | Cookie `sb-auth` no tiene `Secure` | En HTTP plano la cookie viaja en claro. No es un token real (es un marcador `=1`), pero habilita acceso al middleware si alguien la setea manualmente. | Deploy sólo en HTTPS (Vercel lo hace por defecto). El `middleware` no confía realmente en esta cookie para autorizar: las queries a Supabase igual requieren el JWT en `localStorage`. **El bypass del middleware no da acceso a datos**, sólo muestra UI vacía. |
| H3 | No hay **rate limiting** en el login | Fuerza bruta contra `signInWithPassword`. Supabase limita de su lado (~30 intentos/min por IP) pero no está documentado como garantía. | Habilitar **Supabase Auth Rate Limits** (Dashboard → Authentication → Rate Limits). Considerar agregar CAPTCHA si abrís al público. |
| H4 | El nombre y código de producto no están sanitizados contra XSS antes de insertar | React escapa por defecto en JSX → mitigado. Pero el export CSV concatena campos: si un campo empieza con `=`, Excel lo interpreta como fórmula (CSV injection). | Al exportar, prefijar con `'` los valores que empiecen con `=`, `+`, `-`, `@`, tab o CR. |

### 🟡 Medios

| # | Hallazgo | Mitigación |
|---|----------|------------|
| M1 | No hay validación server-side de `price > 0`, código, etc. desde Next — sólo Zod client-side y CHECK constraints del Postgres | OK: las `CHECK` constraints del schema son la autoridad. Mantener. |
| M2 | `.env.local` y `.env.local.example` existen pero no hay `.env.production` ni documentación de variables obligatorias | Documentado en README. Si agregas servicios (ej. Stripe) usar el mismo patrón. |
| M3 | Borrar una variante hace `CASCADE` sobre sus movimientos → pérdida de histórico sin aviso | La UI ya pregunta antes de borrar. Considerar soft-delete (`deleted_at`) si auditoría legal es requisito. |
| M4 | No hay logging de auditoría separado de errores a la consola del browser | Aceptable para una tienda. Si escalás, agregar Sentry o Logflare. |
| M5 | No hay CSP (Content Security Policy) configurada en Next | Definir headers en `next.config.js` o en el host (Vercel/Netlify) cuando subas a producción. Ejemplo mínimo al final. |

### 🟢 Bajos / informativos

- `next.config.js` tiene una clave `tailwindcss` inválida (warning en build). Limpiar.
- No hay tests. El directorio `__tests__/` existe con placeholders.
- `lib/retry.ts` está definido pero no se usa en ningún lado. Se puede eliminar.
- Build genera warning por `tsconfig` (TS 6.0 — versión muy nueva, podría inestabilizar tipado). Si aparecen issues, bajar a TS 5.x.

---

## 3. Qué ya está bien

- **RLS activo** en las 3 tablas con políticas por usuario. Es la única autoridad real de acceso.
- La RPC `register_stock_movement` valida ownership del producto y hace `FOR UPDATE` → previene condiciones de carrera y escrituras cruzadas.
- No existen server actions con `service_role` key — todo pasa por `anon key` + RLS.
- No hay rutas API propias → no hay handlers server a los que inyectar.
- Modo demo, cookies falsas y usuario hardcodeado ya fueron removidos.
- Validación Zod de formato de email y tamaño de password en el cliente.
- Cookie `sb-auth` es sólo un marcador UX para el middleware, no un token real.

---

## 4. Acciones recomendadas antes de producción

En orden de prioridad:

1. **Rotar la `anon key`** si hay chance de que `.env.local` haya estado en git alguna vez.
2. **Desactivar email signups** en Supabase (si vos creás los usuarios).
3. **Activar rate limits** en Supabase Auth.
4. **CSV injection fix** en `reports/page.tsx` (agregar escape de `=+-@\t\r`).
5. **Eliminar `lib/retry.ts`** (código muerto).
6. **Configurar headers de seguridad** en el host (ver sección 6).
7. **Activar MFA** en tu cuenta de Supabase y GitHub.
8. **Crear un segundo proyecto Supabase para staging**; no testees contra prod.

---

## 5. Hosting recomendado

### Opción A — **Vercel + Supabase Cloud** (recomendada)

Es el camino natural de menor fricción para Next.js + Supabase.

**Pros:**
- Deploy automático desde GitHub (push → build → preview URL por PR).
- HTTPS automático, CDN global, Edge Network.
- Plan Hobby gratuito suficiente para una tienda chica (100 GB banda/mes, dominio `.vercel.app`, dominio custom gratis con Let's Encrypt).
- El middleware corre en Vercel Edge — latencia baja.
- Integración nativa con Supabase (importa las env vars desde un botón).

**Contras:**
- Límite de 100 GB-h de serverless en Hobby (más que de sobra para esta app).
- Costos arriba del Hobby suben rápido si la tienda crece mucho.

**Pasos:**

```
1. Push del repo a GitHub (privado).
2. vercel.com → "Add New" → "Project" → importar el repo.
3. En "Environment Variables" cargar:
     NEXT_PUBLIC_SUPABASE_URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY
   (para Production, Preview y Development).
4. Deploy. Te da una URL *.vercel.app.
5. Dominio propio: Project → Domains → agregar `tu-tienda.cl`,
   configurar los DNS que te indique Vercel (A o CNAME).
6. En Supabase → Authentication → URL Configuration:
     Site URL = https://tu-tienda.cl
     Redirect URLs += https://tu-tienda.cl/**
```

**Costo esperado mensual:** US$0 (Vercel Hobby + Supabase Free). Si
superás el Free de Supabase (500 MB DB, 2 GB transferencia), pasás a
Pro a US$25/mes. Vercel Pro son US$20/mes por miembro.

---

### Opción B — **Netlify + Supabase Cloud**

Equivalente a Vercel en funcionalidad. Igual de simple. Elegirlo si ya
tenés cuenta o preferís su UI. Soporta Next.js 14 App Router vía plugin
(ya viene incluido). Mismos pasos de env vars.

---

### Opción C — **Docker + VPS** (DigitalOcean, Hetzner, Railway)

Si necesitás control total o costos fijos.

- Hacer un `Dockerfile` con `node:20-alpine`, `npm ci`, `npm run build`, `CMD ["npm", "start"]`.
- VPS chico (Hetzner CX11, ~€4/mes) basta.
- Frontear con **Caddy** o Nginx para TLS + headers de seguridad.
- Supabase sigue siendo cloud; no self-hostees Supabase a menos que tengas dedicación para ops.

**Contras**: te toca mantener OS, TLS, monitoring.

---

### Opción D — **Self-host Supabase + Coolify** (no recomendada para esta tienda)

Overkill para el tamaño actual. Sólo si hay requisito regulatorio de
que los datos vivan en un servidor propio.

---

## 6. Headers de seguridad recomendados

Para Vercel o Netlify, o en `next.config.js`:

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next necesita unsafe-inline en prod
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
```

Nota: CSP con Next 14 y Tailwind requiere `unsafe-inline` para estilos.
Para una CSP más estricta usar `nonce-*` con el helper de Next, pero es
más complejo y no crítico para esta app.

---

## 7. Checklist mínimo antes del "go live"

- [ ] Rotar `NEXT_PUBLIC_SUPABASE_ANON_KEY` si el `.env.local` estuvo alguna vez en git.
- [ ] Desactivar email signup público en Supabase.
- [ ] Activar rate limits de Auth en Supabase.
- [ ] Configurar `Site URL` y `Redirect URLs` correctas en Supabase.
- [ ] Deploy en HTTPS (Vercel/Netlify lo dan por defecto).
- [ ] Configurar dominio propio.
- [ ] Agregar headers de seguridad (sección 6).
- [ ] Verificar que `schema.sql` está corrido en el proyecto Supabase de producción.
- [ ] Crear el/los usuarios reales desde Supabase → Auth → Users (con "Auto Confirm").
- [ ] Probar login + CRUD + registro de movimiento desde el dominio productivo.
- [ ] Backup de Supabase: en el plan Free está en daily automatic backups; en Pro se pueden descargar.
- [ ] Activar MFA en la cuenta de Supabase.
- [ ] Eliminar este archivo del repo público si no querés exponer el modelo de amenazas (o moverlo a `docs/` privado).
