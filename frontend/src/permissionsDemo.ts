type Permission = {
  patient: string;
  doctor: string;
  recordId: string;
  expiresAt: number;
  revoked: boolean;
};

const KEY = 'femvault-demo-permissions';

function readPermissions(): Permission[] {
  return JSON.parse(localStorage.getItem(KEY) ?? '[]');
}

function writePermissions(permissions: Permission[]) {
  localStorage.setItem(KEY, JSON.stringify(permissions));
}

export function grantAccessDemo(permission: Omit<Permission, 'revoked'>) {
  const permissions = readPermissions().filter(
    (item) => !(item.patient === permission.patient && item.doctor === permission.doctor && item.recordId === permission.recordId)
  );

  permissions.push({ ...permission, revoked: false });
  writePermissions(permissions);
}

export function revokeAccessDemo(args: { patient: string; doctor: string; recordId: string }) {
  const permissions = readPermissions().map((item) => {
    if (item.patient === args.patient && item.doctor === args.doctor && item.recordId === args.recordId) {
      return { ...item, revoked: true };
    }
    return item;
  });

  writePermissions(permissions);
}

export function hasAccessDemo(args: { doctor: string; recordId: string }): { ok: true } | { ok: false; reason: string } {
  const permission = readPermissions().find((item) => item.doctor === args.doctor && item.recordId === args.recordId);

  if (!permission) return { ok: false, reason: 'no permission found' };
  if (permission.revoked) return { ok: false, reason: 'permission revoked' };
  if (permission.expiresAt < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'permission expired' };

  return { ok: true };
}
