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
  Object.entries(perms).forEach(([resource, detail]) => {
    const d = detail as PermissionDetail | undefined | null;
    if (!d) return;
    Object.entries(d as PermissionDetail).forEach(([action, allowed]) => {
      if (allowed) names.push(`${resource}:${action}`);
    });
  });
  return names;
}

// Convert named strings into nested Permissions
export function permissionsFromNames(names: string[]): Permissions {
  const out: Permissions = {};
  names.forEach((n) => {
    const parts = n.includes(':') ? n.split(':') : n.split('.');
    if (parts.length < 2) return;
    const resource = parts[0] as keyof Permissions;
    const action = parts[1] as keyof PermissionDetail;
    const current = out[resource] as PermissionDetailMap | undefined;
    if (!current) {
      const pd: PermissionDetailMap = {};
      pd[action] = true;
      out[resource] = pd;
    } else {
      current[action] = true;
      out[resource] = current;
    }
  });
  return out;
}
