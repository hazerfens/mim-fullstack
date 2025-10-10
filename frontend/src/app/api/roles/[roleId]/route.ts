import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1'

export async function DELETE(req: Request, { params }: { params: { roleId: string } }) {
  try {
    const roleId = params.roleId
    if (!roleId) return NextResponse.json({ status: 'error', message: 'roleId required' }, { status: 400 })

    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    if (!token) return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })

    const res = await fetch(`${BACKEND_API_URL}/roles/${roleId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json({ status: 'error', message: err.error || 'Delete role failed' }, { status: res.status })
    }

    try {
      revalidatePath('/')
      revalidatePath('/dashboard')
      revalidatePath('/dashboard/company/settings')
      revalidatePath('/dashboard/company/settings/roles')
    } catch {}

    return NextResponse.json({ status: 'success' })
  } catch (e) {
    console.error('API proxy delete role error:', e)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}
