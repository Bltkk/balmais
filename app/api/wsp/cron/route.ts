import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  // fail-closed: si no hay CRON_SECRET configurado, denegar siempre
  if (!cronSecret) {
    console.error('CRON_SECRET no configurado — endpoint bloqueado por seguridad')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get('secret')

  const validHeader = authHeader === `Bearer ${cronSecret}`
  const validQuery = querySecret === cronSecret

  if (!validHeader && !validQuery) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const destinatario = process.env.CRON_RECIPIENT
  const mensaje = process.env.CRON_MESSAGE

  if (!phoneNumberId || !accessToken || !destinatario || !mensaje) {
    console.error('Faltan variables de entorno: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, CRON_RECIPIENT o CRON_MESSAGE')
    return NextResponse.json({ error: 'Missing configuration' }, { status: 500 })
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destinatario,
        type: 'text',
        text: { body: mensaje },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Error enviando mensaje cron:', data)
      return NextResponse.json({ error: data }, { status: 500 })
    }

    console.log('Mensaje cron enviado a', destinatario)
    return NextResponse.json({ ok: true, message_id: data.messages?.[0]?.id })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
