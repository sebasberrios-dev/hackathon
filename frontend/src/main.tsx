import React from "react";
import { createRoot } from "react-dom/client";
import {
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Stethoscope,
  User,
  ArrowLeft,
  ClipboardList,
  Trash2,
  Copy,
} from "lucide-react";
import "./styles.css";
import { encryptJson, decryptJson } from "./crypto";
import { connectPhantom, getWalletAddress } from "./wallet";
import {
  grantAccessDemo,
  revokeAccessDemo,
  hasAccessDemo,
  consumeOpenDemo,
} from "./permissionsDemo";
import {
  appendAuditEvent,
  clearAuditLog,
  readAuditLog,
  type AuditEvent,
} from "./auditLog";
import { encodeConsultShareCode, decodeConsultShareCode } from "./shareCode";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type FertilityRecord = {
  lastCycleDate: string;
  ovulationWindow: string;
  symptoms: string;
  notes: string;
};

type StoredRecord = {
  id: string;
  ownerWallet: string;
  encryptedPayload: {
    ciphertext: string;
    iv: string;
    salt: string;
  };
};

type AppMode = "pick" | "patient" | "doctor";

function App() {
  const [mode, setMode] = React.useState<AppMode>("pick");
  const [wallet, setWallet] = React.useState("");
  const [doctorWallet, setDoctorWallet] = React.useState("");
  const [recordId, setRecordId] = React.useState("");
  const [secret, setSecret] = React.useState("demo-secret-123");
  const [maxOpens, setMaxOpens] = React.useState(5);
  const [status, setStatus] = React.useState(
    "Elige si entras como paciente o como médico.",
  );
  const [doctorView, setDoctorView] = React.useState<FertilityRecord | null>(
    null,
  );
  const [auditTrail, setAuditTrail] = React.useState<AuditEvent[]>(() =>
    readAuditLog(),
  );
  /** Generado al otorgar permiso: un solo código para el médico */
  const [shareCode, setShareCode] = React.useState("");
  /** Solo vista médico: código pegado por el médico */
  const [consultCode, setConsultCode] = React.useState("");
  const [form, setForm] = React.useState<FertilityRecord>({
    lastCycleDate: "2026-05-03",
    ovulationWindow: "15–20 may",
    symptoms: "leves molestias",
    notes: "Nota privada de demo",
  });

  function syncAudit() {
    setAuditTrail(readAuditLog());
  }

  function goPick() {
    setMode("pick");
    setDoctorView(null);
    setConsultCode("");
    setStatus("Elige tu rol para continuar.");
  }

  async function connectWallet() {
    try {
      const address = await connectPhantom();
      setWallet(address);
      setStatus(`Conectado: ${short(address)}`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function saveRecord() {
    try {
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) {
        throw new Error(
          "Conecta Phantom con tu wallet para guardar: los datos se asocian a tu identidad.",
        );
      }

      const encryptedPayload = await encryptJson(form, secret);

      const response = await fetch(`${API_URL}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerWallet: currentWallet, encryptedPayload }),
      });

      if (!response.ok) {
        throw new Error(
          "No se pudo guardar. ¿Está el backend en http://localhost:4000?",
        );
      }

      const saved: StoredRecord = await response.json();
      setRecordId(saved.id);
      appendAuditEvent({
        type: "record_sealed",
        recordId: saved.id,
        summary:
          "Registro cifrado guardado fuera de cadena (el servidor no ve texto claro).",
        actorRole: "patient",
        walletShort: short(currentWallet),
      });
      syncAudit();
      setShareCode("");
      setStatus(
        `Guardado. Cuando otorgues permiso al médico, se generará un único código de consulta para pasárselo.`,
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function grantAccess() {
    try {
      const rid = recordId.trim();
      if (!rid) throw new Error("Primero guarda un registro cifrado.");
      if (!doctorWallet.trim()) {
        throw new Error("Indica la wallet del médico al que concedes acceso.");
      }
      const n = Math.max(1, Math.floor(maxOpens));
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) {
        throw new Error("Conecta tu wallet de paciente para dar permiso.");
      }

      grantAccessDemo({
        patient: currentWallet,
        doctor: doctorWallet.trim(),
        recordId: rid,
        maxOpens: n,
        opensUsed: 0,
      });

      const consultPayload = encodeConsultShareCode({
        v: 1,
        recordId: rid,
        secret,
      });
      setShareCode(consultPayload);

      appendAuditEvent({
        type: "consent_granted",
        recordId: rid,
        summary: `Consentimiento: wallet ${short(doctorWallet.trim())}, hasta ${n} apertura(s). Código único de consulta generado para el médico.`,
        actorRole: "patient",
        walletShort: short(currentWallet),
      });
      syncAudit();
      setStatus(
        `Permiso otorgado. Copia el código de consulta de abajo y pásalo al médico por un canal seguro (máx. ${n} apertura(s)).`,
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function revokeAccess() {
    try {
      const rid = recordId.trim();
      if (!rid || !doctorWallet.trim()) {
        throw new Error("Hace falta el código de registro y la wallet del médico.");
      }
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) {
        throw new Error("Conecta tu wallet de paciente para revocar.");
      }

      revokeAccessDemo({
        patient: currentWallet,
        doctor: doctorWallet.trim(),
        recordId: rid,
      });
      appendAuditEvent({
        type: "consent_revoked",
        recordId: rid,
        summary: "La paciente revocó el acceso del médico a este registro.",
        actorRole: "patient",
        walletShort: short(currentWallet),
      });
      syncAudit();
      setShareCode("");
      setStatus("Acceso revocado. El médico ya no debería poder abrir (salvo copias ajenas al sistema).");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function doctorReadRecord() {
    try {
      const parsed = decodeConsultShareCode(consultCode);
      if (!parsed) {
        throw new Error(
          "Código inválido. Pega el código completo que te envió la paciente al otorgar permiso.",
        );
      }
      const { recordId: rid, secret: decryptSecret } = parsed;
      const currentDoctorWallet = wallet || (await getWalletAddress());
      if (!currentDoctorWallet) {
        throw new Error("Conecta la wallet con la que te dieron permiso (Phantom).");
      }

      const permission = hasAccessDemo({
        doctor: currentDoctorWallet,
        recordId: rid,
      });

      if (!permission.ok) {
        setDoctorView(null);
        const reason = (permission as { ok: false; reason: string }).reason;
        appendAuditEvent({
          type: "view_denied",
          recordId: rid,
          summary: `Acceso denegado: ${denialText(reason)}.`,
          actorRole: "doctor",
          walletShort: short(currentDoctorWallet),
        });
        syncAudit();
        setStatus(friendlyDenial(reason));
        return;
      }

      const response = await fetch(`${API_URL}/records/${rid}`);
      if (!response.ok) {
        appendAuditEvent({
          type: "view_denied",
          recordId: rid,
          summary: "Registro no encontrado en el servidor.",
          actorRole: "doctor",
          walletShort: short(currentDoctorWallet),
        });
        syncAudit();
        throw new Error("El registro ya no está en el servidor o el código es antiguo.");
      }

      const record: StoredRecord = await response.json();
      const decrypted = await decryptJson<FertilityRecord>(
        record.encryptedPayload,
        decryptSecret,
      );
      setDoctorView(decrypted);
      consumeOpenDemo({ doctor: currentDoctorWallet, recordId: rid });
      appendAuditEvent({
        type: "view_succeeded",
        recordId: rid,
        summary:
          "Consulta descifrada en local; se consumió 1 apertura del cupo acordado.",
        actorRole: "doctor",
        walletShort: short(currentDoctorWallet),
      });
      syncAudit();
      setStatus(
        "Consulta mostrada. Queda un intento menos en el permiso (si aplica).",
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  function updateField(key: keyof FertilityRecord, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <main className="page">
      <div className="top-bar">
        <div className="brand">
          <Shield size={20} />
          <span>Vitaseed</span>
        </div>
        {mode !== "pick" && (
          <div className="top-bar__meta">
            <span className="role-pill">
              {mode === "patient" ? (
                <>
                  <User size={16} /> Modo paciente
                </>
              ) : (
                <>
                  <Stethoscope size={16} /> Modo médico (demo)
                </>
              )}
            </span>
            <button type="button" className="btn-ghost" onClick={goPick}>
              <ArrowLeft size={16} /> Cambiar rol
            </button>
          </div>
        )}
      </div>

      {mode === "pick" && (
        <section className="hero">
          <div className="badge">
            <Shield size={16} /> MVP — Privacidad y consentimiento
          </div>
          <h1>Vitaseed</h1>
          <p>
            Tus datos de fertilidad cifrados; tú concedes cuántas veces puede
            abrir el médico. La cadena (próximamente) prueba el consentimiento,
            no almacena tu historia clínica.
          </p>
          <div className="role-picker">
            <button
              type="button"
              className="role-card"
              onClick={() => {
                setMode("patient");
                setDoctorView(null);
                setStatus(
                  "Modo paciente: conecta Phantom y guarda tu registro cifrado.",
                );
              }}
            >
              <User size={28} aria-hidden />
              <strong>Paciente</strong>
            </button>
            <button
              type="button"
              className="role-card"
              onClick={() => {
                setMode("doctor");
                setDoctorView(null);
                setStatus(
                  "Modo médico: conecta la wallet con la que te dieron acceso. MVP: no verificamos colegiación; cualquier wallet puede probar el flujo.",
                );
              }}
            >
              <Stethoscope size={28} aria-hidden />
              <strong>Médico</strong>
            </button>
          </div>
        </section>
      )}

      {mode === "patient" && (
        <section className="workspace">
          <p className="hint strong">
            Conecta <strong>Phantom</strong> con la wallet con la que quieres
            asociar tus datos. Sin wallet no se puede guardar el registro.
          </p>
          <button type="button" onClick={() => void connectWallet()}>
            Conectar Phantom
          </button>
          <p className="muted">
            {wallet
              ? `Wallet: ${short(wallet)}`
              : "Aún no conectada — pulsa arriba cuando estés lista."}
          </p>

          <div className="grid-2">
            <div className="card">
              <h2>
                <Lock size={20} /> Tu registro cifrado
              </h2>
              <label>Fecha último ciclo</label>
              <input
                value={form.lastCycleDate}
                onChange={(e) => updateField("lastCycleDate", e.target.value)}
              />
              <label>Ventana fértil (tu estimación)</label>
              <input
                value={form.ovulationWindow}
                onChange={(e) =>
                  updateField("ovulationWindow", e.target.value)
                }
              />
              <label>Síntomas</label>
              <input
                value={form.symptoms}
                onChange={(e) => updateField("symptoms", e.target.value)}
              />
              <label>Notas privadas</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
              <label>Clave de cifrado (solo tu equipo)</label>
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              <p className="hint">
                Se usa para cifrar al guardar. Al otorgar permiso se empaqueta
                automáticamente en el <strong>código único</strong> que recibirá
                el médico — no hace falta dictarla aparte.
              </p>
              <button type="button" onClick={() => void saveRecord()}>
                Guardar registro cifrado
              </button>
              <p className="muted">
                Registro interno: <strong>{recordId || "— guarda primero —"}</strong>
              </p>
            </div>

            <div className="card">
              <h2>
                <Unlock size={20} /> Permiso al médico
              </h2>
              <label>Wallet del médico (a quién mostrar datos)</label>
              <input
                value={doctorWallet}
                onChange={(e) => setDoctorWallet(e.target.value.trim())}
                placeholder="Pega la dirección Phantom del médico"
                autoComplete="off"
                spellCheck={false}
              />
              <label>Cuántas veces puede abrir el registro</label>
              <input
                type="number"
                min={1}
                value={maxOpens}
                onChange={(e) =>
                  setMaxOpens(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <p className="hint">
                Cada vez que el médico descifra con éxito se cuenta como una
                consulta. Fallos por permiso o contraseña no consumen intentos.
              </p>
              <button type="button" onClick={() => void grantAccess()}>
                Otorgar permiso
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void revokeAccess()}
              >
                Revocar permiso
              </button>

              {shareCode ? (
                <div className="share-code-box">
                  <label>Código único para el médico</label>
                  <p className="hint">
                    Incluye permiso + datos para descifrar este registro. Pásalo
                    por un canal seguro; quien lo tenga puede abrir mientras haya
                    cupos y consentimiento activo.
                  </p>
                  <textarea
                    className="share-code-text"
                    readOnly
                    rows={4}
                    value={shareCode}
                  />
                  <button
                    type="button"
                    className="btn-inline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareCode);
                        setStatus("Código copiado al portapapeles.");
                      } catch {
                        setStatus(
                          "No se pudo copiar automáticamente; selecciona el texto manualmente.",
                        );
                      }
                    }}
                  >
                    <Copy size={16} aria-hidden /> Copiar código
                  </button>
                </div>
              ) : (
                <p className="hint" style={{ marginTop: 16 }}>
                  Tras <strong>Otorgar permiso</strong> aparecerá aquí el código
                  que debes enviar al médico.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {mode === "doctor" && (
        <section className="workspace">
          <div className="banner-demo">
            <strong>Demo MVP:</strong> no verificamos licencia médica. Cualquier
            wallet puede probar el rol médico; en producción solo la wallet que
            la paciente autorice podrá abrir.
          </div>
          <button type="button" onClick={() => void connectWallet()}>
            Conectar Phantom (wallet del médico)
          </button>
          <p className="muted">
            {wallet
              ? `Wallet médico: ${short(wallet)}`
              : "Conecta la cuenta con la que la paciente concedió permiso."}
          </p>

          <div className="card doctor-single">
            <h2>
              <Eye size={20} /> Consulta autorizada
            </h2>
            <label>Código de consulta (enviado por la paciente)</label>
            <textarea
              className="consult-code-input"
              value={consultCode}
              onChange={(e) => setConsultCode(e.target.value)}
              placeholder="Pega aquí el código largo que te envió la paciente al otorgar permiso"
              rows={4}
              spellCheck={false}
            />
            <button type="button" onClick={() => void doctorReadRecord()}>
              Ver consulta
            </button>
            {doctorView ? (
              <div className="result">
                <p>
                  <b>Último ciclo:</b> {doctorView.lastCycleDate}
                </p>
                <p>
                  <b>Ventana fértil:</b> {doctorView.ovulationWindow}
                </p>
                <p>
                  <b>Síntomas:</b> {doctorView.symptoms}
                </p>
                <p>
                  <b>Notas:</b> {doctorView.notes}
                </p>
              </div>
            ) : (
              <div className="blocked">
                <EyeOff size={18} /> Sin datos — conecta tu wallet autorizada y
                pega el código de consulta que te envió la paciente.
              </div>
            )}
          </div>
        </section>
      )}

      {(mode === "patient" || mode === "doctor") && (
        <section className="audit-section card">
          <div className="audit-head">
            <h2>
              <ClipboardList size={20} /> Registro de auditoría (MVP)
            </h2>
            <button
              type="button"
              className="btn-inline"
              onClick={() => {
                clearAuditLog();
                syncAudit();
                setStatus("Historial de auditoría borrado (solo esta sesión demo).");
              }}
            >
              <Trash2 size={14} /> Limpiar historial
            </button>
          </div>
          <p className="hint">
            Cada acción importante queda aquí (en el navegador). En producción
            se puede replicar en Solana para que sea verificable.
          </p>
          {auditTrail.length === 0 ? (
            <p className="muted">Aún no hay eventos.</p>
          ) : (
            <ul className="audit-list">
              {auditTrail.map((ev) => (
                <li key={ev.id} className="audit-item">
                  <div className="audit-row">
                    <span className="audit-type">{formatType(ev.type)}</span>
                    <time dateTime={new Date(ev.ts).toISOString()}>
                      {new Date(ev.ts).toLocaleString()}
                    </time>
                  </div>
                  <p className="audit-meta">
                    {ev.actorRole} · {ev.walletShort ?? "—"} · registro{" "}
                    <code>{ev.recordId}</code>
                  </p>
                  <p>{ev.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="status">
        <b>Estado:</b> {status}
      </section>
    </main>
  );
}

function short(address: string) {
  if (!address || address.length <= 12) return address || "—";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function denialText(reason: string): string {
  const map: Record<string, string> = {
    no_permission: "sin consentimiento para esta wallet y registro",
    permission_revoked: "permiso revocado por la paciente",
    attempts_exhausted: "se agotaron las aperturas permitidas",
  };
  return map[reason] ?? reason;
}

function friendlyDenial(reason: string): string {
  const map: Record<string, string> = {
    no_permission:
      "Sin permiso activo: la paciente debe otorgarte acceso con tu wallet y pasarte el código de consulta.",
    permission_revoked: "La paciente revocó el acceso.",
    attempts_exhausted:
      "No quedan aperturas: la paciente debe otorgar un nuevo permiso.",
  };
  return map[reason] ?? `Acceso denegado (${reason}).`;
}

function formatType(t: AuditEvent["type"]): string {
  const m: Record<AuditEvent["type"], string> = {
    record_sealed: "Registro guardado",
    consent_granted: "Consentimiento",
    consent_revoked: "Revocación",
    view_succeeded: "Consulta vista",
    view_denied: "Acceso denegado",
  };
  return m[t];
}

createRoot(document.getElementById("root")!).render(<App />);
