import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { companyId, role } = body
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    if (!token) return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })

    const url = companyId ? `${BACKEND_API_URL}/company/${companyId}/roles` : `${BACKEND_API_URL}/roles`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(role),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json({ status: 'error', message: err.error || 'Create role failed' }, { status: res.status })
    }

    // soft revalidate
    try {
      revalidatePath('/')
      revalidatePath('/dashboard')
      revalidatePath('/dashboard/company/settings')
      revalidatePath('/dashboard/company/settings/roles')
    } catch {}

    const data = await res.json()
    return NextResponse.json({ status: 'success', role: data })
  } catch (e) {
    console.error('API proxy create role error:', e)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}
