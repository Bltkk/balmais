/**
 * API Security Utilities
 * 
 * Proporciona funciones de validación y seguridad para los endpoints
 */

import { NextRequest, NextResponse } from 'next/server'

// ─── Validación de API Key ──────────────────────────────────────────────
export function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader) {
    return false
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return false
  }

  const token = parts[1]
  const validKey = process.env.API_KEY

  if (!validKey) {
    console.error('API_KEY not configured')
    return false
  }

  // Usar comparación constante para evitar timing attacks
  return constantTimeCompare(token, validKey)
}

// ─── Comparación constante (previene timing attacks) ──────────────────
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

// ─── Respuesta de error no autorizado ────────────────────────────────
export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}

// ─── Validación de parámetros numéricos ─────────────────────────────
export function validateNumericParam(
  value: string | null,
  defaultValue: number,
  min: number = 0,
  max: number = Infinity
): number {
  if (!value) return defaultValue

  const parsed = parseInt(value, 10)

  if (isNaN(parsed)) {
    return defaultValue
  }

  return Math.max(min, Math.min(max, parsed))
}

// ─── Validación de UUID ─────────────────────────────────────────────
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

// ─── Sanitización de strings ────────────────────────────────────────
export function sanitizeString(input: string, maxLength: number = 255): string {
  if (!input) return ''

  // Remover caracteres de control
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '')

  // Limitar longitud
  sanitized = sanitized.substring(0, maxLength)

  return sanitized.trim()
}

// ─── Validación de período ──────────────────────────────────────────
export function validatePeriod(period: string | null): '7d' | '30d' | '90d' | '365d' | 'all' {
  const validPeriods = ['7d', '30d', '90d', '365d', 'all']
  
  if (!period || !validPeriods.includes(period)) {
    return '30d' // default
  }

  return period as '7d' | '30d' | '90d' | '365d' | 'all'
}

// ─── Validación de tipo de movimiento ────────────────────────────────
export function validateMovementType(type: string | null): 'in' | 'out' | null {
  if (type === 'in' || type === 'out') {
    return type
  }
  return null
}

// ─── Validación de cantidad ─────────────────────────────────────────
export function validateQuantity(quantity: any): number | null {
  const parsed = parseInt(quantity, 10)

  if (isNaN(parsed) || parsed <= 0) {
    return null
  }

  // Limitar a cantidad razonable (máximo 1 millón)
  if (parsed > 1000000) {
    return null
  }

  return parsed
}

// ─── Rate limiting simple (en memoria) ──────────────────────────────
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minuto
): boolean {
  const now = Date.now()
  const record = requestCounts.get(identifier)

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

// ─── Limpieza de rate limiting ──────────────────────────────────────
export function cleanupRateLimitRecords() {
  const now = Date.now()
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key)
    }
  }
}

// Ejecutar limpieza cada 5 minutos
if (typeof global !== 'undefined') {
  setInterval(cleanupRateLimitRecords, 5 * 60 * 1000)
}

// ─── Validación de JSON ─────────────────────────────────────────────
export async function parseJSON(request: NextRequest): Promise<any> {
  try {
    const contentType = request.headers.get('content-type')
    
    if (!contentType?.includes('application/json')) {
      throw new Error('Invalid Content-Type')
    }

    const body = await request.json()
    return body
  } catch (error) {
    throw new Error('Invalid JSON body')
  }
}

// ─── Respuesta de error genérica ────────────────────────────────────
export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json(
    { error: message },
    { status }
  )
}

// ─── Respuesta de éxito ────────────────────────────────────────────
export function successResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status })
}

// ─── Validación de rango de fechas ─────────────────────────────────
export function validateDateRange(
  startDate: string | null,
  endDate: string | null
): { start: Date | null; end: Date | null; valid: boolean } {
  const result = { start: null as Date | null, end: null as Date | null, valid: true }

  if (startDate) {
    try {
      result.start = new Date(startDate)
      if (isNaN(result.start.getTime())) {
        result.valid = false
      }
    } catch {
      result.valid = false
    }
  }

  if (endDate) {
    try {
      result.end = new Date(endDate)
      if (isNaN(result.end.getTime())) {
        result.valid = false
      }
    } catch {
      result.valid = false
    }
  }

  // Validar que start < end
  if (result.start && result.end && result.start > result.end) {
    result.valid = false
  }

  // Limitar a máximo 2 años
  if (result.start && result.end) {
    const diffMs = result.end.getTime() - result.start.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays > 730) {
      result.valid = false
    }
  }

  return result
}

// ─── Logging de seguridad ──────────────────────────────────────────
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: 'info' | 'warning' | 'error' = 'info'
) {
  const timestamp = new Date().toISOString()
  const log = {
    timestamp,
    event,
    severity,
    ...details,
  }

  if (severity === 'error') {
    console.error('[SECURITY]', JSON.stringify(log))
  } else if (severity === 'warning') {
    console.warn('[SECURITY]', JSON.stringify(log))
  } else {
    console.log('[SECURITY]', JSON.stringify(log))
  }
}
