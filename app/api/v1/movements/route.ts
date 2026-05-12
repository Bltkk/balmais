import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/v1/movements
 * 
 * Obtiene historial de movimientos de stock
 * 
 * Query params:
 * - limit: número de movimientos (default: 100, max: 1000)
 * - offset: para paginación (default: 0)
 * - type: 'in' | 'out' (opcional)
 * - productId: filtrar por producto (opcional)
 * - variantId: filtrar por variante (opcional)
 * - startDate: fecha inicio (ISO format)
 * - endDate: fecha fin (ISO format)
 * 
 * Headers requeridos:
 * - Authorization: Bearer <API_KEY>
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type')
    const productId = searchParams.get('productId')
    const variantId = searchParams.get('variantId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabaseAdmin
      .from('stock_movements')
      .select(`
        id,
        type,
        quantity,
        stock_after,
        notes,
        commission,
        created_at,
        variant:product_variants(
          id,
          size,
          product:products(id, code, name, price, cost)
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    if (variantId) {
      query = query.eq('variant_id', variantId)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: movements, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Enriquecer datos
    const enriched = (movements || []).map((m: any) => {
      const product = m.variant?.product
      const price = product?.price || 0
      const cost = product?.cost || 0
      const value = m.quantity * price
      const costValue = m.quantity * cost

      return {
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        stockAfter: m.stock_after,
        notes: m.notes,
        commission: m.commission,
        createdAt: m.created_at,
        product: {
          id: product?.id,
          code: product?.code,
          name: product?.name,
          price,
          cost,
        },
        variant: {
          id: m.variant?.id,
          size: m.variant?.size,
        },
        value,
        costValue,
        margin: value - costValue,
      }
    })

    // Calcular totales
    const totalQuantity = enriched.reduce((sum: number, m: any) => sum + m.quantity, 0)
    const totalValue = enriched.reduce((sum: number, m: any) => sum + m.value, 0)
    const totalCostValue = enriched.reduce((sum: number, m: any) => sum + m.costValue, 0)

    return NextResponse.json({
      success: true,
      data: enriched,
      totals: {
        quantity: totalQuantity,
        value: Math.round(totalValue * 100) / 100,
        costValue: Math.round(totalCostValue * 100) / 100,
        margin: Math.round((totalValue - totalCostValue) * 100) / 100,
      },
      pagination: {
        limit,
        offset,
        total: count,
        hasMore: offset + limit < (count || 0),
      },
    })
  } catch (error) {
    console.error('Error fetching movements:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
