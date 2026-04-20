# Checklist de endurecimiento en el dashboard de Supabase

Lo que **no se puede arreglar desde SQL/código** y tenés que cambiar
con clicks en [supabase.com/dashboard](https://supabase.com/dashboard).

## 1. Ejecutar los SQL de hardening

Supabase → **SQL Editor** → New query:

1. Pega y corré `supabase/schema.sql` (si no lo hiciste o si hubo
   cambios de modelo).
2. Pega y corré `supabase/hardening.sql`.

## 2. Autenticación

Supabase → **Authentication** → **Providers** → **Email**:

- [ ] **Desactivar "Enable Signup"** si sos vos quien crea los usuarios.
      (Deja "Confirm email" encendido por si lo reactivás.)
- [ ] Minimum password length: subir a **8** (está en 6 por defecto).

Supabase → **Authentication** → **Rate Limits**:

- [ ] Sign in with password: dejar o bajar a **30/hora por IP**.
- [ ] Sign up: bajar a **5/hora por IP** (o 0 si signup está off).
- [ ] Anonymous sign-ins: **desactivar** si no lo usás.

Supabase → **Authentication** → **URL Configuration**:

- [ ] `Site URL`: la URL final de producción (ej. `https://tu-tienda.cl`).
- [ ] `Redirect URLs`: agregar `https://tu-tienda.cl/**` y borrar
      `localhost` cuando estés en prod.

## 3. API

Supabase → **Settings** → **API**:

- [ ] **Anotá la fecha de creación de la `anon key`**. Si `.env.local`
      alguna vez estuvo en git (público), **rotá la key** con el botón
      "Generate new anon key" y actualizá la variable en Vercel/Netlify.
- [ ] La `service_role` key **nunca** debe aparecer en el código. Esta
      app no la usa; si la rotás, ningún deploy se rompe.

## 4. Base de datos

Supabase → **Database** → **Backups**:

- [ ] En plan Free: backups diarios automáticos retenidos 7 días.
      Suficiente para una tienda.
- [ ] En plan Pro: podés descargar backups manuales. Hacelo antes de
      cambios grandes de schema.

Supabase → **Database** → **Replication / Webhooks**:

- [ ] No habilitar webhooks salientes salvo necesidad puntual.

## 5. Cuenta / organización

- [ ] **MFA activado** en tu cuenta personal de Supabase.
- [ ] Invitar colaboradores con rol **Developer** o **Read-only**; evitar
      Owner salvo para vos.
- [ ] Activar "Require MFA for all members" en la organización si tenés
      plan Team.

## 6. Storage (si lo usás a futuro)

Esta app no usa Supabase Storage. Si llegás a subir imágenes de
productos, creá el bucket como **privado** y usá URLs firmadas, no
públicas.

## 7. Logs y alertas

Supabase → **Logs**:

- [ ] Revisar periódicamente **Auth logs** para ver intentos fallidos
      de login.
- [ ] **Postgres logs** para errores de RLS ("permission denied for
      relation") — indican código mal escrito o intentos de intrusión.

## 8. Qué hacer si sospechás de una clave filtrada

1. **API → Generate new anon key** (invalida la anterior).
2. Actualizá `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel y redeployá.
3. **Authentication → Users**: si sospechás de credenciales de usuario
   filtradas, resetear su contraseña desde ahí.
4. Revisá **Logs → Postgres** buscando accesos anómalos.
