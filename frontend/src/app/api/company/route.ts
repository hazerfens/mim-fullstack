import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1'

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { companyId, updates } = body
    if (!companyId) return NextResponse.json({ status: 'error', message: 'companyId required' }, { status: 400 })

    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    if (!token) return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })

    const res = await fetch(`${BACKEND_API_URL}/company/${companyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(updates),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json({ status: 'error', message: err.error || 'Update failed' }, { status: res.status })
    }

    // Revalidate the company settings page so server components refresh
    try {
      // Revalidate canonical company settings route
      revalidatePath('/dashboard/company/settings')
    } catch (e) {
      console.warn('revalidatePath failed', e)
    }

    return NextResponse.json({ status: 'success' })
  } catch (e) {
    console.error('API proxy company update error:', e)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}
