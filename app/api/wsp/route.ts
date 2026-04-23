import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  text?: { body: string }
  type: string
}

interface WhatsAppEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: { display_phone_number: string; phone_number_id: string }
      messages?: WhatsAppMessage[]
    }
    field: string
  }>
}

async function sendWhatsAppMessage(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.error('Missing WhatsApp credentials')
    return
  }

  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}

async function findProductByCode(code: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('products')
    .select('*, variants:product_variants(id, size, current_stock)')
    .eq('code', code)
    .eq('user_id', userId)
    .single()
  return data
}

function resolveVariant(
  product: { name: string; code: string; variants?: { id: string; size: string; current_stock: number }[] },
  size: string | null
): { variant?: { id: string; size: string; current_stock: number }; error?: string } {
  const variants = product.variants ?? []

  if (variants.length === 0) {
    return { error: 'Este producto no tiene tallas registradas.' }
  }

  if (size) {
    const v = variants.find(v => v.size.toUpperCase() === size.toUpperCase())
    if (!v) {
      const available = variants.map(v => v.size).join(', ')
      return { error: `Talla "${size}" no encontrada. Disponibles: ${available}` }
    }
    return { variant: v }
  }

  if (variants.length === 1) {
    return { variant: variants[0] }
  }

  const available = variants.map(v => `${v.size}(${v.current_stock})`).join(', ')
  return { error: `Especificá la talla. Disponibles: ${available}\nEjemplo: P${product.code} M 5` }
}

async function handleStockOperation(
  code: string,
  size: string | null,
  quantity: number,
  type: 'in' | 'out',
  userId: string
): Promise<string> {
  const product = await findProductByCode(code, userId)
  if (!product) return `Producto con código "${code}" no encontrado.`

  const { variant, error } = resolveVariant(product, size)
  if (error || !variant) return `❌ ${error}`

  const { data, error: rpcError } = await supabaseAdmin.rpc('register_stock_movement_admin', {
    p_variant_id: variant.id,
    p_type: type,
    p_quantity: quantity,
    p_notes: 'Via WhatsApp',
    p_user_id: userId,
  })

  if (rpcError) {
    const msg = rpcError.message ?? 'Error desconocido'
    return `❌ ${msg}`
  }

  const sign = type === 'out' ? `-${quantity}` : `+${quantity}`
  const emoji = type === 'out' ? '📦' : '📥'
  return `${emoji} Stock actualizado!\n\nProducto: ${product.name} (${code})\nTalla: ${variant.size}\nCantidad: ${sign}\nStock nuevo: ${data.stock_after}`
}

async function handleStockQuery(code: string, userId: string): Promise<string> {
  const product = await findProductByCode(code, userId)
  if (!product) return `Producto "${code}" no encontrado.`

  const variants = product.variants ?? []
  const total = variants.reduce((s: number, v: { current_stock: number }) => s + v.current_stock, 0)

  let res = `📦 ${product.name} (${code})\nPrecio: $${product.price}\n\nStock por talla:\n`
  variants.forEach((v: { size: string; current_stock: number }) => {
    const icon = v.current_stock === 0 ? '❌' : v.current_stock < 5 ? '⚠️' : '✅'
    res += `${icon} ${v.size}: ${v.current_stock}\n`
  })
  res += `\n📊 Total: ${total} unidades`
  return res
}

async function handleListProducts(userId: string): Promise<string> {
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('*, variants:product_variants(current_stock)')
    .eq('user_id', userId)
    .order('code')

  if (!products || products.length === 0) return 'No hay productos registrados.'

  let res = `📋 Productos (${products.length}):\n\n`
  products.slice(0, 10).forEach((p: { code: string; name: string; variants?: { current_stock: number }[] }) => {
    const total = (p.variants ?? []).reduce((s, v) => s + v.current_stock, 0)
    res += `• ${p.code} — ${p.name}: ${total} uds\n`
  })
  if (products.length > 10) res += `\n...y ${products.length - 10} más`
  return res
}

function formatHelp(): string {
  return (
    `📱 *Comandos disponibles:*\n\n` +
    `• *P<código> <cantidad>* — Restar stock\n` +
    `  Ej: P001 5\n` +
    `  Con talla: P001 M 5\n\n` +
    `• *+ <código> <cantidad>* — Agregar stock\n` +
    `  Ej: + P001 10\n` +
    `  Con talla: + P001 M 10\n\n` +
    `• *STOCK <código>* — Ver stock de un producto\n` +
    `  Ej: STOCK P001\n\n` +
    `• *LISTA* — Ver todos los productos\n\n` +
    `• *AYUDA* — Mostrar este mensaje`
  )
}

// Formato "P<code> [size] <quantity>"
const SUBTRACT_RE = /^[Pp](\S+)\s+(.+)$/

async function processCommand(message: string, userId: string): Promise<string> {
  const trimmed = message.trim()

  // P<code> [size] <qty>  →  restar stock
  const pMatch = trimmed.match(SUBTRACT_RE)
  if (pMatch) {
    const code = pMatch[1].toUpperCase()
    const rest = pMatch[2].trim().split(/\s+/)

    let size: string | null = null
    const quantityStr = rest[rest.length - 1]
    if (rest.length >= 2) size = rest.slice(0, -1).join(' ').toUpperCase()

    const quantity = parseInt(quantityStr, 10)
    if (isNaN(quantity) || quantity <= 0) {
      return 'Cantidad inválida.\nUso: P<código> <cantidad>\nCon talla: P<código> <talla> <cantidad>'
    }

    return handleStockOperation(code, size, quantity, 'out', userId)
  }

  const parts = trimmed.toUpperCase().split(/\s+/)
  const command = parts[0]

  switch (command) {
    case '+':
    case 'AGREGAR': {
      // + <code> [size] <qty>
      if (parts.length < 3) {
        return 'Uso: + <código> <cantidad>\nCon talla: + <código> <talla> <cantidad>'
      }
      const code = parts[1]
      const rest = parts.slice(2)
      let size: string | null = null
      const quantityStr = rest[rest.length - 1]
      if (rest.length >= 2) size = rest.slice(0, -1).join(' ')

      const quantity = parseInt(quantityStr, 10)
      if (isNaN(quantity) || quantity <= 0) return 'Cantidad inválida.'

      return handleStockOperation(code, size, quantity, 'in', userId)
    }

    case 'STOCK':
    case 'CONSULTAR': {
      const code = parts[1]
      if (!code) return 'Uso: STOCK <código>\nEj: STOCK P001'
      return handleStockQuery(code, userId)
    }

    case 'LISTA':
    case 'PRODUCTOS': {
      return handleListProducts(userId)
    }

    case 'AYUDA':
    case 'HELP':
    case '?': {
      return formatHelp()
    }

    default:
      return `Comando no reconocido: "${parts[0]}"\n\nEscribí *AYUDA* para ver los comandos disponibles.`
  }
}

// GET: Verificar webhook con Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Unauthorized', { status: 403 })
}

// POST: Recibir mensajes entrantes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const entry: WhatsAppEntry = body.entry?.[0]

    if (!entry?.changes?.[0]?.value?.messages) {
      return NextResponse.json({ status: 'ok' })
    }

    const message = entry.changes[0].value.messages[0]
    const userId = process.env.WHATSAPP_DEFAULT_USER_ID

    if (!userId) {
      console.error('WHATSAPP_DEFAULT_USER_ID not configured')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    if (message.type === 'text' && message.text?.body) {
      try {
        const responseText = await processCommand(message.text.body, userId)
        await sendWhatsAppMessage(message.from, responseText)
      } catch (err) {
        console.error('Error processing command:', err)
        await sendWhatsAppMessage(message.from, '❌ Ocurrió un error. Intentá de nuevo.')
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
