# API Security Documentation

## Overview

Esta API implementa múltiples capas de seguridad para proteger tu sistema de inventario.

## Security Features

### 1. Authentication

**Método:** Bearer Token (API Key)

```
Authorization: Bearer <API_KEY>
```

**Características:**
- Validación en todos los endpoints (excepto `/health`)
- Comparación constante de tokens (previene timing attacks)
- API key configurada en `.env.local`

**Cambiar API Key:**
```bash
# Generar nueva clave segura
openssl rand -hex 32

# Actualizar en .env.local
API_KEY=nueva-clave-aqui
```

### 2. Input Validation

Todos los parámetros se validan:

- **Números:** Rango mínimo/máximo, tipo de dato
- **Strings:** Longitud máxima, caracteres de control removidos
- **UUIDs:** Formato válido
- **Fechas:** Rango máximo de 2 años
- **Cantidades:** Máximo 1,000,000 unidades

**Ejemplo:**
```typescript
// Validación automática
const limit = validateNumericParam(searchParams.get('limit'), 50, 1, 500)
// Resultado: siempre entre 1 y 500
```

### 3. SQL Injection Prevention

- Uso de Supabase RLS (Row Level Security)
- Parámetros preparados (no concatenación de strings)
- Sanitización de inputs
- Validación de tipos

**Seguro:**
```typescript
query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`)
// Supabase maneja el escape automáticamente
```

### 4. XSS Prevention

- Validación de Content-Type
- Sanitización de strings
- Respuestas JSON (no HTML)
- Límites de longitud en campos

### 5. Rate Limiting

**Límites por IP:**
- GET requests: 100 por minuto
- POST requests: 50 por minuto

**Implementación:**
```typescript
if (!checkRateLimit(clientIp, 100, 60000)) {
  return errorResponse('Too many requests', 429)
}
```

### 6. CORS & Headers

- Content-Type validation
- Método HTTP validation
- Security headers en respuestas

### 7. Error Handling

**Seguro:**
```json
{
  "error": "Insufficient stock"
}
```

**NO expone:**
- Detalles internos de BD
- Stack traces
- Rutas del servidor
- Información de usuarios

### 8. Logging de Seguridad

Todos los eventos de seguridad se registran:

```typescript
logSecurityEvent('unauthorized_access', {
  endpoint: '/api/v1/products',
  method: 'GET',
}, 'warning')
```

**Eventos registrados:**
- Accesos no autorizados
- Rate limit exceeded
- Errores de validación
- Cambios de stock
- Errores de BD

## Best Practices

### 1. API Key Management

✅ **Hacer:**
- Usar claves largas y aleatorias (32+ caracteres)
- Rotar claves regularmente
- Usar variables de entorno
- Diferentes claves por ambiente

❌ **NO hacer:**
- Hardcodear claves en código
- Compartir claves públicamente
- Usar claves débiles
- Reutilizar claves entre ambientes

### 2. HTTPS Only

Siempre usar HTTPS en producción:

```bash
# Verificar certificado SSL
curl -I https://tu-dominio.com/api/v1/health
```

### 3. Monitoreo

Revisar logs de seguridad regularmente:

```bash
# Ver eventos de seguridad
grep "\[SECURITY\]" logs/app.log
```

### 4. Validación en Cliente

Aunque la API valida, también valida en cliente:

```typescript
// Validar antes de enviar
if (quantity <= 0 || quantity > 1000000) {
  throw new Error('Invalid quantity')
}
```

## Vulnerabilidades Conocidas & Mitigación

### 1. Timing Attacks

**Mitigación:** Comparación constante de tokens
```typescript
function constantTimeCompare(a: string, b: string): boolean {
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
```

### 2. Brute Force

**Mitigación:** Rate limiting por IP
```typescript
checkRateLimit(clientIp, 100, 60000) // 100 requests/min
```

### 3. Data Exposure

**Mitigación:** RLS en Supabase
```sql
CREATE POLICY "products_select_own" ON products
  FOR SELECT USING (auth.uid() = user_id);
```

### 4. CSRF

**Mitigación:** API stateless, tokens en headers
```
Authorization: Bearer <token>
```

## Testing Security

### Ejecutar tests de seguridad

```bash
npm test -- __tests__/api/v1/security.test.ts
```

### Tests incluidos

- ✅ Autenticación (válida/inválida)
- ✅ Validación de entrada
- ✅ SQL injection prevention
- ✅ XSS prevention
- ✅ Rate limiting
- ✅ Error handling
- ✅ Data type validation

## Incident Response

### Si sospechas una brecha:

1. **Inmediato:**
   - Cambiar API_KEY en `.env.local`
   - Revisar logs de seguridad
   - Identificar accesos no autorizados

2. **Corto plazo:**
   - Auditar cambios de stock
   - Verificar integridad de datos
   - Notificar a usuarios afectados

3. **Largo plazo:**
   - Implementar 2FA
   - Mejorar monitoreo
   - Realizar security audit

## Compliance

### GDPR

- ✅ Datos encriptados en tránsito (HTTPS)
- ✅ Acceso controlado (API key)
- ✅ Logs de auditoría
- ✅ Validación de entrada

### PCI DSS (si procesas pagos)

- ✅ No almacenar datos de tarjetas
- ✅ Encriptación en tránsito
- ✅ Acceso controlado
- ✅ Monitoreo

## Recursos

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [API Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/REST_API_Security_Cheat_Sheet.html)
- [Supabase Security](https://supabase.com/docs/guides/security)

## Contacto

Para reportar vulnerabilidades de seguridad, contacta a: security@tu-dominio.com

**NO** publiques vulnerabilidades públicamente.
