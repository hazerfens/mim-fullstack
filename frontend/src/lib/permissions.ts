// Shared permission types and helpers used by both client and server
export interface PermissionDetail {
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
}

export type PermissionDetailMap = PermissionDetail & { [action: string]: boolean | undefined };

export interface Permissions {
  users?: PermissionDetail;
  companies?: PermissionDetail;
  roles?: PermissionDetail;
  branches?: PermissionDetail;
  departments?: PermissionDetail;
  reports?: PermissionDetail;
  settings?: PermissionDetail;
  // Custom permissions map for permission names not covered by top-level keys
  custom?: Record<string, PermissionDetail>;
}

export interface PermissionCatalogEntry {
  name: string;
  display_name?: string | null;
  description?: string | null;
  is_active?: boolean;
}

// Flatten nested Permissions -> named strings (resource:action)
export function permissionNamesFromPermissions(perms?: Permissions): string[] {
  if (!perms) return [];
  const names: string[] = [];
  // Standard top-level resources
  const std = ['users', 'companies', 'branches', 'departments', 'roles', 'reports', 'settings'] as const;
  const vals = perms as unknown as Record<string, unknown>;
  for (const r of std) {
    const d = vals[r] as PermissionDetail | undefined | null;
    if (!d) continue;
    Object.entries(d as PermissionDetail).forEach(([action, allowed]) => {
      if (allowed) names.push(`${r}:${action}`);
    });
  }
  // Custom permissions map
  if (perms.custom) {
    Object.entries(perms.custom).forEach(([customName, detail]) => {
      if (!detail) return;
      Object.entries(detail).forEach(([action, allowed]) => {
        if (allowed) names.push(`${customName}:${action}`);
      });
    });
  }
  return names;
}

// Convert named strings into nested Permissions
export function permissionsFromNames(names: string[]): Permissions {
  const out: Permissions = {};
  const setAction = (d: PermissionDetail | undefined, a: keyof PermissionDetail): PermissionDetail => {
    const next: PermissionDetail = d ? { ...d } : {};
    if (a === 'create') next.create = true;
    if (a === 'read') next.read = true;
    if (a === 'update') next.update = true;
    if (a === 'delete') next.delete = true;
    return next;
  }

  names.forEach((n) => {
    const parts = n.includes(':') ? n.split(':') : n.split('.');
    if (parts.length < 2) return;
    const resource = parts[0];
    const action = parts[1] as keyof PermissionDetail;
    switch (resource) {
      case 'users':
        out.users = setAction(out.users, action);
        break;
      case 'companies':
        out.companies = setAction(out.companies, action);
        break;
      case 'branches':
        out.branches = setAction(out.branches, action);
        break;
      case 'departments':
        out.departments = setAction(out.departments, action);
        break;
      case 'roles':
        out.roles = setAction(out.roles, action);
        break;
      case 'reports':
        out.reports = setAction(out.reports, action);
        break;
      case 'settings':
        out.settings = setAction(out.settings, action);
        break;
      default:
      out.custom = out.custom || {};
      out.custom[resource] = setAction(out.custom[resource], action);
        break;
    }
  });
  return out;
}
