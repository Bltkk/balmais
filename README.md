# Sistema de Gestión de Inventario

Aplicación web de inventario con Next.js 14 + Supabase.

## Funcionalidades

- Login con Supabase Auth (email + password)
- CRUD de productos (código, nombre, descripción, precio, stock)
- Dashboard con totales (productos, stock, valor, movimientos del día)
- Reportes de movimientos con filtros (fecha, tipo) y exportación CSV
- RLS en Supabase: cada usuario sólo ve sus propios datos

## Stack

Next.js 14 · React 18 · TypeScript · Tailwind · Supabase · Zod

## Puesta en marcha

### 1. Variables de entorno

Copia `.env.local.example` a `.env.local` y completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

### 2. Base de datos

En Supabase → SQL Editor → New query, pega el contenido de
[`supabase/schema.sql`](supabase/schema.sql) y ejecútalo una vez. Es
idempotente (se puede re-ejecutar sin error).

### 3. Crear el primer usuario

En Supabase → Authentication → Users → **Add user** (email + password,
con "Auto Confirm User" activado). Ese usuario es el que usarás para
ingresar a la app.

### 4. Instalar y correr

```bash
npm install
npm run dev     # desarrollo en http://localhost:3000
npm run build   # build de producción
npm start       # servidor de producción
```

## Despliegue

Cualquier host compatible con Next.js 14 (Vercel recomendado). Define las
dos variables `NEXT_PUBLIC_SUPABASE_*` en el panel del host. No hay
secretos server-side adicionales: todo pasa por RLS.

## Estructura

```
app/
  (auth)/login/           – página de login
  (dashboard)/            – layout protegido + páginas
    page.tsx              – dashboard (totales, recientes)
    products/             – lista y alta
    reports/              – historial + CSV
lib/supabase.ts           – cliente Supabase + helpers de cookie
lib/validations.ts        – esquemas Zod
middleware.ts             – protege rutas vía cookie sb-auth
supabase/schema.sql       – esquema único para Supabase
types/                    – tipos de dominio
```
