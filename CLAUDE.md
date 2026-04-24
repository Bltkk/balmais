# CLAUDE.md — contexto para Claude Code

> Lee esto antes de hacer cambios. Está pensado para ahorrar tokens: no
> hace falta re-explorar el proyecto en cada sesión.

## Qué es

Sistema de gestión de inventario mono-tenant por usuario. Next.js 14
(App Router) + Supabase (Postgres + Auth). Español primario.

## Arquitectura de autenticación

**No hay server actions de auth ni cookies httpOnly.** El login usa
Supabase client-side (`supabase.auth.signInWithPassword`) y persiste la
sesión en `localStorage` vía `@supabase/supabase-js`. Para que el
middleware de Next pueda distinguir "usuario autenticado" desde el
servidor, se setea una cookie marcador `sb-auth=1` (no httpOnly, no
sensible) en el login y se borra en el logout.

Flujo:

1. `app/(auth)/login/page.tsx` → `signInWithPassword` → `setAuthCookie()` → redirect `/`.
2. `middleware.ts` → comprueba existencia de cookie `sb-auth`:
   - con cookie y ruta pública → redirect `/`
   - sin cookie y ruta protegida → redirect `/login`
3. `app/(dashboard)/layout.tsx` logout → `supabase.auth.signOut()` + `clearAuthCookie()`.

Helpers en `lib/supabase.ts`: `supabase`, `setAuthCookie`, `clearAuthCookie`.
`AUTH_COOKIE = 'sb-auth'`.

**Consecuencia importante:** las páginas obtienen `user.id` con
`supabase.auth.getUser()` en el cliente. No hay lectura de sesión en
server components. Mantener este patrón al agregar funcionalidad.

## Base de datos

Archivo único: `supabase/schema.sql`. **Al re-ejecutar hace `DROP TABLE`
de las tablas de dominio** (no es idempotente sobre datos — re-ejecutar
borra productos, variantes y movimientos). Para cambios de schema, se
edita este archivo y se re-corre en Supabase.

Modelo (ropa, stock por talla):

- **`products`** — metadata: `code, name, description, price, user_id`.
  **No guarda stock.**
- **`product_variants`** — una fila por talla del producto:
  `(product_id, size, current_stock)` con `UNIQUE(product_id, size)`.
  Es la tabla donde vive el stock real.
- **`stock_movements`** — cada entrada/salida apunta a una variante:
  `(variant_id, type 'in'|'out', quantity, stock_after, notes, user_id)`.

Stock total de un producto = `SUM(variants.current_stock)`. La UI lo
calcula en el cliente; no está materializado.

RPC crítica: **`register_stock_movement(p_variant_id, p_type, p_quantity,
p_notes)`** — único camino válido para sumar o restar stock. Hace
`FOR UPDATE` sobre la variante, valida ownership vía `products.user_id =
auth.uid()`, actualiza `current_stock`, inserta movimiento. Llamarla con
`supabase.rpc('register_stock_movement', { p_variant_id, p_type,
p_quantity, p_notes })`. **No hacer `update products_variants` +
`insert stock_movements` por separado** — perdés atomicidad y la
validación de stock negativo.

RLS habilitado en las tres tablas. Cada usuario ve y modifica solo sus
propios productos; variantes y movimientos heredan vía el producto
padre.

## Convenciones del repo

- **Cliente Supabase único** exportado desde `lib/supabase.ts`. No crear
  clientes nuevos en componentes.
- Páginas de dashboard son **client components** (`'use client'`) y
  llaman a Supabase directamente. Sin server actions.
- Tipos de dominio en `types/database.ts` (`Product`, `StockMovement`).
- Validación con Zod en `lib/validations.ts` (esquemas `productSchema`,
  `stockMovementSchema`, `loginSchema`).
- Tailwind utility classes directas, sin componentes de UI librarizados.

## Funcionalidad implementada

- Login / logout
- Lista de productos con búsqueda, orden y **filas expandibles** que
  muestran las variantes por talla con botones `+` / `−`
- Modal de movimiento de stock (suma / resta por talla) invocando la
  RPC `register_stock_movement`
- Alta de producto con tallas dinámicas (el form permite agregar/quitar
  filas `{size, stock_inicial}` y crea producto + variantes)
- Eliminación de producto (cascade borra variantes y movimientos)
- Dashboard con totales reales (suma de `variants.current_stock`)
- Reportes con filtros de fecha/tipo y export CSV, incluyendo columna
  de talla

- Edición de producto en `/products/[id]`: cambiar código, nombre,
  descripción, precio, agregar/quitar tallas. **Importante**: el stock
  inicial de una talla agregada acá NO genera un `stock_movement` —
  para auditoría de stock correcta, usar siempre la RPC desde la lista.

- Validación de nombre duplicado en `/products/new`: antes de insertar,
  se verifica con `.ilike('name', ...)` si ya existe un producto con el
  mismo nombre. Si existe, muestra un banner amber con link a la lista
  y opción "Crear de todos modos" (`skipDuplicateCheck`).

## Modelo de datos de analíticas (cierre diario)

Las analíticas usan un modelo de **día confirmado**: los movimientos del
día en curso se excluyen de todos los gráficos y KPIs de
`app/(dashboard)/analytics/page.tsx`. La query `movQuery` lleva siempre
`.lt('created_at', startOfToday.toISOString())`.

Esto evita que errores corregidos el mismo día ensucien las métricas
históricas. A medianoche, el día cierra automáticamente y sus movimientos
pasan a ser historial permanente — sin ninguna acción manual.

El dashboard (`app/(dashboard)/page.tsx`) muestra una tarjeta
**"Hoy — provisional"** (amber) con entradas, salidas y neto del día en
curso en tiempo real. Solo aparece si hay al menos un movimiento hoy.

Pendiente:

- Editar `current_stock` directamente de una variante ya existente (se
  puede hacer vía movimientos, pero no hay un "ajuste de inventario"
  dedicado).

## Cosas a NO hacer

- No reintroducir "modo demo", botones demo ni UUIDs hardcodeados de
  usuario. Se eliminaron a propósito.
- No crear server actions para operaciones que Supabase ya resuelve
  desde el cliente con RLS.
- No volver a partir el schema en múltiples archivos `.sql`. Un solo
  `supabase/schema.sql`.
- No asumir cookies httpOnly de Supabase. La sesión vive en
  `localStorage`; la cookie `sb-auth` es sólo un marcador.

## Comandos

```
npm run dev     # dev server en :3000
npm run build   # build prod
npm start       # prod server
npm test        # jest (no hay tests aún tras la limpieza)
```

## Env

Sólo dos variables públicas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## WhatsApp Integration

Sistema de comandos vía WhatsApp Business API en `app/api/wsp/route.ts`.

**Variables de entorno requeridas:**
- `SUPABASE_SERVICE_ROLE_KEY` - clave de service role para operaciones admin
- `WHATSAPP_ACCESS_TOKEN` - token de la API de WhatsApp
- `WHATSAPP_PHONE_NUMBER_ID` - ID del número de teléfono
- `WHATSAPP_VERIFY_TOKEN` - token para verificar el webhook
- `WHATSAPP_DEFAULT_USER_ID` - usuario de Supabase que recibe los comandos

**Comandos disponibles:**
- `P<codigo> <cantidad>` - Restar stock (ej: `P001 5`)
- `+ <codigo> <cantidad>` - Agregar stock (ej: `+ P001 10`)
- `STOCK <codigo>` - Consultar stock de un producto
- `LISTA` - Ver todos los productos
- `AYUDA` - Mostrar ayuda

El webhook procesa mensajes entrantes y responde automáticamente. Requiere configurar el webhook en Meta for Developers apuntando a `/api/wsp`.
