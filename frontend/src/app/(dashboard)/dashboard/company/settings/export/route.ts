import { NextResponse } from 'next/server';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.BACKEND_API_URL || 'http://localhost:3333/api/v1';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    if (!companyId) return new NextResponse('companyId required', { status: 400 });

    // Parse access_token from cookie header
    const cookieHeader = req.headers.get('cookie') || '';
    const token = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('access_token='))
      ? cookieHeader
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('access_token='))
          ?.split('=')[1]
      : undefined;
    if (!token) return new NextResponse('Unauthorized', { status: 401 });

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Fetch company (active) - optional
    const companyRes = await fetch(`${BACKEND_API_URL}/company/active`, { headers, cache: 'no-store' });
    const company = companyRes.ok ? await companyRes.json() : null;

    // members
    const membersRes = await fetch(`${BACKEND_API_URL}/company/${companyId}/members`, { headers, cache: 'no-store' });
    const members = membersRes.ok ? await membersRes.json() : null;

    // invitations
    const invitationsRes = await fetch(`${BACKEND_API_URL}/company/${companyId}/invitations`, { headers, cache: 'no-store' });
    const invitations = invitationsRes.ok ? await invitationsRes.json() : null;

    // roles
    const rolesRes = await fetch(`${BACKEND_API_URL}/roles`, { headers, cache: 'no-store' });
    let roles = null;
    if (rolesRes.ok) {
      const rolesBody = await rolesRes.json();
      if (rolesBody && typeof rolesBody === 'object' && Array.isArray((rolesBody as Record<string, unknown>)['roles'])) {
        const list = (rolesBody as Record<string, unknown>)['roles'] as unknown[];
        roles = list.filter((r) => {
          const rid = (r as Record<string, unknown>)['company_id'] as unknown;
          return rid === companyId || (typeof rid === 'string' && rid === companyId);
        });
      } else if (Array.isArray(rolesBody)) {
        const list = rolesBody as unknown[];
        roles = list.filter((r) => {
          const rid = (r as Record<string, unknown>)['company_id'] as unknown;
          return rid === companyId || (typeof rid === 'string' && rid === companyId);
        });
      }
    }

    const exportObj = { company, members, invitations, roles };
    const filename = `company-${companyId}-export.json`;
    const body = JSON.stringify(exportObj, null, 2);

    const resHeaders = new Headers();
    resHeaders.set('Content-Type', 'application/json');
    resHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(body, { status: 200, headers: resHeaders });
  } catch (err) {
    console.error('Export route error', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
