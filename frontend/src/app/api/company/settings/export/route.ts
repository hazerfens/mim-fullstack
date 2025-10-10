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

    // Figure out models to include from ?models=a,b
    const modelsParam = url.searchParams.get('models') || '';
    const modelsSet = new Set(modelsParam.split(',').map((s) => s.trim()).filter(Boolean));
    const includeAll = modelsSet.size === 0;

    // Fetch company if needed (and to validate owner)
    let company = null;
    if (includeAll || modelsSet.has('company') || modelsSet.has('branches') || modelsSet.has('departments') || modelsSet.has('members')) {
      const companyRes = await fetch(`${BACKEND_API_URL}/company/active`, { headers, cache: 'no-store' });
      company = companyRes.ok ? await companyRes.json() : null;
    }

    if (!company) return new NextResponse('Company not found', { status: 404 });

    // Enforce owner-only export: verify current user is owner
    const currentUserRes = await fetch(`${BACKEND_API_URL}/user/me`, { headers, cache: 'no-store' });
    if (!currentUserRes.ok) return new NextResponse('Unauthorized', { status: 401 });
    const currentUser = await currentUserRes.json();
  const c = company as unknown as Record<string, unknown>;
  const ownerId = (c?.user_id as string | undefined) || ((c?.user as Record<string, unknown>)?.id as string | undefined);
    if (!ownerId || !currentUser || currentUser.id !== ownerId) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Conditionally fetch datasets
    let members = null;
    if (includeAll || modelsSet.has('members')) {
      const membersRes = await fetch(`${BACKEND_API_URL}/company/${companyId}/members`, { headers, cache: 'no-store' });
      members = membersRes.ok ? await membersRes.json() : null;
    }

    let invitations = null;
    if (includeAll || modelsSet.has('invitations')) {
      const invitationsRes = await fetch(`${BACKEND_API_URL}/company/${companyId}/invitations`, { headers, cache: 'no-store' });
      invitations = invitationsRes.ok ? await invitationsRes.json() : null;
    }

    let roles = null;
    if (includeAll || modelsSet.has('roles')) {
      const rolesRes = await fetch(`${BACKEND_API_URL}/roles`, { headers, cache: 'no-store' });
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
    }

    const branches = (includeAll || modelsSet.has('branches')) ? (company?.branches ?? null) : null;
    const departments = (includeAll || modelsSet.has('departments')) ? (company?.departments ?? null) : null;

    const exportObj: Record<string, unknown> = {};
    if (includeAll || modelsSet.has('company')) exportObj.company = company;
    if (includeAll || modelsSet.has('members')) exportObj.members = members;
    if (includeAll || modelsSet.has('invitations')) exportObj.invitations = invitations;
    if (includeAll || modelsSet.has('roles')) exportObj.roles = roles;
    if (includeAll || modelsSet.has('branches')) exportObj.branches = branches;
    if (includeAll || modelsSet.has('departments')) exportObj.departments = departments;

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
