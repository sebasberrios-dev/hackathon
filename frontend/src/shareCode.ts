/**
 * Código único de consulta (MVP): empaqueta referencia al registro + material de descifrado.
 * La paciente genera este string al otorgar permiso y solo lo pasa al médico.
 * Producción: sustituir por envoltura criptográfica hacia la clave pública del médico.
 */

export type SharePayload = {
  v: 1;
  recordId: string;
  secret: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeConsultShareCode(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodeConsultShareCode(code: string): SharePayload | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(trimmed));
    const p = JSON.parse(json) as SharePayload;
    if (p.v !== 1 || typeof p.recordId !== "string" || typeof p.secret !== "string") {
      return null;
    }
    if (!p.recordId.trim() || !p.secret) return null;
    return p;
  } catch {
    return null;
  }
}
