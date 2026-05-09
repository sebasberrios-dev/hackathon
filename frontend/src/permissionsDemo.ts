/**
 * MVP: permisos locales. Producción: mismo modelo en Solana (Anchor).
 * Consentimiento por número máximo de aperturas exitosas del médico.
 */

export type Permission = {
  patient: string;
  doctor: string;
  recordId: string;
  revoked: boolean;
  /** Veces que el médico puede abrir y descifrar con éxito */
  maxOpens: number;
  /** Contador incrementado solo tras vista exitosa */
  opensUsed: number;
};

const KEY = "vitaseed-demo-permissions-v2";

function readPermissions(): Permission[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Permission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePermissions(permissions: Permission[]) {
  localStorage.setItem(KEY, JSON.stringify(permissions));
}

export function grantAccessDemo(
  permission: Omit<Permission, "revoked" | "opensUsed"> & {
    opensUsed?: number;
  },
) {
  const permissions = readPermissions().filter(
    (item) =>
      !(
        item.patient === permission.patient &&
        item.doctor === permission.doctor &&
        item.recordId === permission.recordId
      ),
  );

  permissions.push({
    ...permission,
    revoked: false,
    opensUsed: permission.opensUsed ?? 0,
  });
  writePermissions(permissions);
}

export function revokeAccessDemo(args: {
  patient: string;
  doctor: string;
  recordId: string;
}) {
  const permissions = readPermissions().map((item) => {
    if (
      item.patient === args.patient &&
      item.doctor === args.doctor &&
      item.recordId === args.recordId
    ) {
      return { ...item, revoked: true };
    }
    return item;
  });

  writePermissions(permissions);
}

export function hasAccessDemo(args: {
  doctor: string;
  recordId: string;
}): { ok: true } | { ok: false; reason: string } {
  const permission = readPermissions().find(
    (item) => item.doctor === args.doctor && item.recordId === args.recordId,
  );

  if (!permission) return { ok: false, reason: "no_permission" };
  if (permission.revoked) return { ok: false, reason: "permission_revoked" };
  if (permission.opensUsed >= permission.maxOpens)
    return { ok: false, reason: "attempts_exhausted" };

  return { ok: true };
}

/** Llamar solo tras descifrado exitoso (una “consulta” consumida). */
export function consumeOpenDemo(args: { doctor: string; recordId: string }) {
  const permissions = readPermissions().map((item) => {
    if (
      item.doctor === args.doctor &&
      item.recordId === args.recordId &&
      !item.revoked
    ) {
      return { ...item, opensUsed: item.opensUsed + 1 };
    }
    return item;
  });
  writePermissions(permissions);
}
