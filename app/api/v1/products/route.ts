import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  validateApiKey,
  unauthorizedResponse,
  validateNumericParam,
  sanitizeString,
  checkRateLimit,
  logSecurityEvent,
  successResponse,
  errorResponse,
} from '@/lib/api-security'

/**
 * GET /api/v1/products
 * 
 * Obtiene lista de productos con stock actual
 * 
 * Query params:
 * - limit: número de productos (default: 50, max: 500)
 * - offset: para paginación (default: 0)
 * - search: buscar por código o nombre
 * - status: 'active' | 'discontinued' (default: 'active')
 * 
 * Headers requeridos:
 * - Authorization: Bearer <API_KEY>
 */
export async function GET(request: NextRequest) {
  try {
    // Validar API key
    if (!validateApiKey(request)) {
      logSecurityEvent('unauthorized_access', {
        endpoint: '/api/v1/products',
        method: 'GET',
      }, 'warning')
      return unauthorizedResponse()
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(clientIp, 100, 60000)) {
      logSecurityEvent('rate_limit_exceeded', {
        endpoint: '/api/v1/products',
        clientIp,
      }, 'warning')
      return errorResponse('Too many requests', 429)
    }

    const { searchParams } = new URL(request.url)
    const limit = validateNumericParam(searchParams.get('limit'), 50, 1, 500)
    const offset = validateNumericParam(searchParams.get('offset'), 0, 0)
    const search = sanitizeString(searchParams.get('search') || '', 100)
    const status = sanitizeString(searchParams.get('status') || 'active', 20)

    const userId = process.env.API_USER_ID
    if (!userId) {
      return errorResponse('API_USER_ID not configured', 500)
    }

    let query = supabaseAdmin
      .from('products')
      .select(`
        id,
        code,
        name,
        description,
        price,
        cost,
        status,
        created_at,
        updated_at,
        variants:product_variants(
          id,
          size,
          current_stock
        )
      `)
      .eq('user_id', userId)
      .eq('status', status)
      .order('code')
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data: products, error, count } = await query

    if (error) {
      logSecurityEvent('database_error', {
        endpoint: '/api/v1/products',
        error: error.message,
      }, 'error')
      return errorResponse('Internal server error', 500)
    }

    // Enriquecer con totales
    const enriched = (products || []).map((p: any) => {
      const totalStock = p.variants?.reduce((sum: number, v: any) => sum + v.current_stock, 0) || 0
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        price: p.price,
        cost: p.cost,
        margin: p.price - p.cost,
        marginPercent: ((p.price - p.cost) / p.price * 100).toFixed(2),
        status: p.status,
        totalStock,
        stockValue: totalStock * p.price,
        variants: p.variants,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    })

    return successResponse({
      success: true,
      data: enriched,
      pagination: {
        limit,
        offset,
        total: count,
        hasMore: offset + limit < (count || 0),
      },
    })
  } catch (error) {
    logSecurityEvent('api_error', {
      endpoint: '/api/v1/products',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'error')
    return errorResponse('Internal server error', 500)
  }
}
