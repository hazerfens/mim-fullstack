import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const companyId = body.companyId
    if (!companyId) return NextResponse.json({ status: 'error', message: 'companyId required' }, { status: 400 })

  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
    if (!token) return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })

    const res = await fetch(`${BACKEND_API_URL}/company/${companyId}/permanent`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json({ status: 'error', message: err.error || 'Delete failed' }, { status: res.status })
    }

    return NextResponse.json({ status: 'success' })
  } catch (e) {
    console.error('API proxy delete permanent error:', e)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}
