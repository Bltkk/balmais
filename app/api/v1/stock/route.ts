import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  validateApiKey,
  unauthorizedResponse,
  validateQuantity,
  validateMovementType,
  checkRateLimit,
  logSecurityEvent,
  parseJSON,
  errorResponse,
  successResponse,
} from '@/lib/api-security'

/**
 * GET /api/v1/stock
 * 
 * Obtiene estado actual del stock de todos los productos
 * 
 * Query params:
 * - productId: filtrar por producto específico (opcional)
 * - includeVariants: incluir detalles de variantes (default: true)
 * 
 * Headers requeridos:
 * - Authorization: Bearer <API_KEY>
 */
export async function GET(request: NextRequest) {
  try {
    // Validar API key
    if (!validateApiKey(request)) {
      logSecurityEvent('unauthorized_access', {
        endpoint: '/api/v1/stock',
        method: 'GET',
      }, 'warning')
      return unauthorizedResponse()
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(clientIp, 100, 60000)) {
      return errorResponse('Too many requests', 429)
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const includeVariants = searchParams.get('includeVariants') !== 'false'

    let query = supabaseAdmin
      .from('products')
      .select(`
        id,
        code,
        name,
        price,
        cost,
        variants:product_variants(
          id,
          size,
          current_stock
        )
      `)
      .order('code')

    if (productId) {
      query = query.eq('id', productId)
    }

    const { data: products, error } = await query

    if (error) {
      logSecurityEvent('database_error', {
        endpoint: '/api/v1/stock',
        error: error.message,
      }, 'error')
      return errorResponse('Internal server error', 500)
    }

    const enriched = (products || []).map((p: any) => {
      const totalStock = p.variants?.reduce((sum: number, v: any) => sum + v.current_stock, 0) || 0
      const stockValue = totalStock * p.price

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        price: p.price,
        cost: p.cost,
        totalStock,
        stockValue,
        status: totalStock === 0 ? 'out_of_stock' : totalStock < 5 ? 'low_stock' : 'in_stock',
        ...(includeVariants && {
          variants: p.variants?.map((v: any) => ({
            id: v.id,
            size: v.size,
            stock: v.current_stock,
            value: v.current_stock * p.price,
          })),
        }),
      }
    })

    // Calcular totales
    const totalStock = enriched.reduce((sum: number, p: any) => sum + p.totalStock, 0)
    const totalValue = enriched.reduce((sum: number, p: any) => sum + p.stockValue, 0)

    return successResponse({
      success: true,
      data: enriched,
      totals: {
        totalProducts: enriched.length,
        totalStock,
        totalValue,
        outOfStock: enriched.filter((p: any) => p.status === 'out_of_stock').length,
        lowStock: enriched.filter((p: any) => p.status === 'low_stock').length,
      },
    })
  } catch (error) {
    console.error('Error fetching stock:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/stock
 * 
 * Actualiza el stock de un producto
 * 
 * Body:
 * {
 *   variantId: string,
 *   quantity: number,
 *   type: 'in' | 'out',
 *   notes?: string
 * }
 * 
 * Headers requeridos:
 * - Authorization: Bearer <API_KEY>
 */
export async function POST(request: NextRequest) {
  try {
    // Validar API key
    if (!validateApiKey(request)) {
      logSecurityEvent('unauthorized_access', {
        endpoint: '/api/v1/stock',
        method: 'POST',
      }, 'warning')
      return unauthorizedResponse()
    }

    // Rate limiting (más restrictivo para POST)
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(clientIp, 50, 60000)) {
      logSecurityEvent('rate_limit_exceeded', {
        endpoint: '/api/v1/stock',
        method: 'POST',
        clientIp,
      }, 'warning')
      return errorResponse('Too many requests', 429)
    }

    const body = await parseJSON(request)
    const { variantId, quantity, type, notes } = body

    // Validar campos requeridos
    if (!variantId || quantity === undefined || !type) {
      logSecurityEvent('invalid_request', {
        endpoint: '/api/v1/stock',
        missing: {
          variantId: !variantId,
          quantity: quantity === undefined,
          type: !type,
        },
      }, 'warning')
      return errorResponse('Missing required fields: variantId, quantity, type', 400)
    }

    // Validar tipo de movimiento
    const validType = validateMovementType(type)
    if (!validType) {
      return errorResponse('Type must be "in" or "out"', 400)
    }

    // Validar cantidad
    const validQuantity = validateQuantity(quantity)
    if (!validQuantity) {
      return errorResponse('Quantity must be a positive number (max 1,000,000)', 400)
    }

    // Obtener variante actual
    const { data: variant } = await supabaseAdmin
      .from('product_variants')
      .select('current_stock, product_id')
      .eq('id', variantId)
      .single()

    if (!variant) {
      logSecurityEvent('variant_not_found', {
        endpoint: '/api/v1/stock',
        variantId,
      }, 'warning')
      return errorResponse('Variant not found', 404)
    }

    // Validar stock suficiente para salidas
    if (validType === 'out' && variant.current_stock < validQuantity) {
      logSecurityEvent('insufficient_stock', {
        endpoint: '/api/v1/stock',
        variantId,
        available: variant.current_stock,
        requested: validQuantity,
      }, 'warning')
      return errorResponse(
        `Insufficient stock. Available: ${variant.current_stock}, Requested: ${validQuantity}`,
        400
      )
    }

    // Calcular nuevo stock
    const newStock = validType === 'in' 
      ? variant.current_stock + validQuantity 
      : variant.current_stock - validQuantity

    // Actualizar variante
    await supabaseAdmin
      .from('product_variants')
      .update({ current_stock: newStock })
      .eq('id', variantId)

    // Registrar movimiento
    const { data: movement, error: movementError } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        variant_id: variantId,
        type: validType,
        quantity: validQuantity,
        stock_after: newStock,
        notes: notes ? notes.substring(0, 500) : `Updated via API - ${validType === 'in' ? 'Stock added' : 'Stock removed'}`,
        commission: 0,
        user_id: process.env.WHATSAPP_DEFAULT_USER_ID,
      })
      .select()
      .single()

    if (movementError) {
      logSecurityEvent('movement_record_error', {
        endpoint: '/api/v1/stock',
        error: movementError.message,
      }, 'error')
      return errorResponse('Failed to record movement', 500)
    }

    logSecurityEvent('stock_updated', {
      endpoint: '/api/v1/stock',
      variantId,
      type: validType,
      quantity: validQuantity,
      previousStock: variant.current_stock,
      newStock,
    }, 'info')

    return successResponse({
      success: true,
      data: {
        variantId,
        previousStock: variant.current_stock,
        newStock,
        quantity: validQuantity,
        type: validType,
        movement,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid JSON body') {
      return errorResponse('Invalid JSON body', 400)
    }
    logSecurityEvent('api_error', {
      endpoint: '/api/v1/stock',
      method: 'POST',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'error')
    return errorResponse('Internal server error', 500)
  }
}
