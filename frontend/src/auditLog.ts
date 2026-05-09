export type AuditEventType =
  | "record_sealed"
  | "consent_granted"
  | "consent_revoked"
  | "view_succeeded"
  | "view_denied";

export type AuditEvent = {
  id: string;
  ts: number;
  type: AuditEventType;
  recordId: string;
  summary: string;
  actorRole: "patient" | "doctor" | "system";
  walletShort?: string;
};

const KEY = "vitaseed-demo-audit";
const MAX = 120;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readAuditLog(): AuditEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as AuditEvent[];
  } catch {
    return [];
  }
}

export function appendAuditEvent(
  partial: Omit<AuditEvent, "id" | "ts"> & { ts?: number },
): AuditEvent {
  const ev: AuditEvent = {
    id: uid(),
    ts: partial.ts ?? Date.now(),
    ...partial,
  };
  const list = readAuditLog();
  list.unshift(ev);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  return ev;
}

export function clearAuditLog() {
  localStorage.removeItem(KEY);
}
