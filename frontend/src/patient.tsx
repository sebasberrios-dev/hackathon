import React from "react";
import { createRoot } from "react-dom/client";
import {
  Shield,
  Lock,
  Share2,
  ClipboardList,
  Trash2,
  Copy,
  User,
  CheckCircle,
  XCircle,
  Link2,
} from "lucide-react";
import "./styles.css";
import { encryptJson } from "./crypto";
import { grantAccessDemo, revokeAccessDemo } from "./permissionsDemo";
import {
  appendAuditEvent,
  clearAuditLog,
  readAuditLog,
  type AuditEvent,
} from "./auditLog";
import { encodeConsultShareCode } from "./shareCode";
import { useAuth } from "./useAuth";

type FertilityRecord = {
  lastCycleDate: string;
  ovulationWindow: string;
  symptoms: string;
  notes: string;
};

type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  salt: string;
};

function formatType(t: AuditEvent["type"]): string {
  const m: Record<AuditEvent["type"], string> = {
    record_sealed: "Record saved",
    consent_granted: "Access link created",
    consent_revoked: "Access revoked",
    view_succeeded: "Record viewed",
    view_denied: "Access denied",
  };
  return m[t];
}

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function PatientApp() {
  const { authenticated, wallet, displayName, login, logout } = useAuth();
  const [nameInput, setNameInput] = React.useState("");

  // Record state
  const [recordId, setRecordId] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [maxOpens, setMaxOpens] = React.useState(3);
  const [shareLink, setShareLink] = React.useState("");
  const [encryptedPayload, setEncryptedPayload] =
    React.useState<EncryptedPayload | null>(null);
  const [auditTrail, setAuditTrail] = React.useState<AuditEvent[]>(() =>
    readAuditLog(),
  );
  const [toast, setToast] = React.useState("");

  const [form, setForm] = React.useState<FertilityRecord>({
    lastCycleDate: "2026-05-03",
    ovulationWindow: "May 15–20",
    symptoms: "Mild discomfort",
    notes: "Private health note",
  });

  function syncAudit() {
    setAuditTrail(readAuditLog());
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function updateField(key: keyof FertilityRecord, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveRecord() {
    try {
      const autoSecret = secret || generateSecret();
      if (!secret) setSecret(autoSecret);

      const payload = await encryptJson(form, autoSecret);
      const rid = Array.from(crypto.getRandomValues(new Uint8Array(5)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setEncryptedPayload(payload);
      setRecordId(rid);
      setShareLink("");

      appendAuditEvent({
        type: "record_sealed",
        recordId: rid,
        summary:
          "Record encrypted in your browser. Your data never left this device in readable form.",
        actorRole: "patient",
        walletShort: displayName,
      });
      syncAudit();
      showToast("Record saved and encrypted.");
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`);
    }
  }

  async function generateLink() {
    try {
      if (!recordId) throw new Error("Save your health record first.");
      if (!wallet) throw new Error("Please sign in first.");
      if (!encryptedPayload) throw new Error("Save your health record first.");

      const n = Math.max(1, Math.floor(maxOpens));
      const currentSecret = secret || generateSecret();
      if (!secret) setSecret(currentSecret);

      grantAccessDemo({
        patient: wallet,
        doctor: "shared-link",
        recordId,
        maxOpens: n,
        opensUsed: 0,
      });

      const code = encodeConsultShareCode({
        v: 1,
        recordId,
        secret: currentSecret,
        encryptedPayload,
      });
      const link = `${window.location.origin}/doctor.html?c=${code}`;
      setShareLink(link);

      appendAuditEvent({
        type: "consent_granted",
        recordId,
        summary: `Access link created. Doctor can open the record up to ${n} time(s).`,
        actorRole: "patient",
        walletShort: displayName,
      });
      syncAudit();
      showToast("Access link generated!");
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`);
    }
  }

  async function revokeAccess() {
    try {
      if (!recordId) throw new Error("No record to revoke.");
      revokeAccessDemo({ patient: wallet, doctor: "shared-link", recordId });
      appendAuditEvent({
        type: "consent_revoked",
        recordId,
        summary: "Access revoked. The shared link is now invalid.",
        actorRole: "patient",
        walletShort: displayName,
      });
      syncAudit();
      setShareLink("");
      showToast("Access revoked. The link no longer works.");
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`);
    }
  }

  // ── Login screen ──────────────────────────────────────────
  if (!authenticated) {
    return (
      <main className="page">
        <nav className="top-bar">
          <div className="brand">
            <Shield size={18} />
            <span>Vitaseed</span>
          </div>
          <a href="/" className="btn-ghost">
            ← Home
          </a>
        </nav>
        <div className="login-screen">
          <div className="login-card">
            <div className="login-icon">
              <User size={28} />
            </div>
            <h2 className="login-title">Welcome</h2>
            <p className="login-sub">
              Your health data stays on your device, fully encrypted. Enter
              your name to get started.
            </p>
            <label>Your name</label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. María García"
              autoFocus
              onKeyDown={(e) =>
                e.key === "Enter" && nameInput.trim() && login(nameInput)
              }
            />
            <button
              type="button"
              style={{ marginTop: 20 }}
              disabled={!nameInput.trim()}
              onClick={() => login(nameInput)}
            >
              Get started
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Main app ──────────────────────────────────────────────
  return (
    <main className="page">
      {toast && <div className="toast">{toast}</div>}

      <nav className="top-bar">
        <div className="brand">
          <Shield size={18} />
          <span>Vitaseed</span>
        </div>
        <div className="top-bar__right">
          <span className="role-pill">
            <User size={13} /> {displayName}
          </span>
          <button
            type="button"
            className="btn-ghost"
            style={{ margin: 0 }}
            onClick={logout}
          >
            Sign out
          </button>
          <a href="/" className="btn-ghost">
            ← Home
          </a>
        </div>
      </nav>

      <div className="grid-2">
        {/* Left: Record form */}
        <div className="card">
          <div className="section-title">
            <Lock size={17} /> Health record
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            All fields are encrypted in your browser before anything is saved.
          </p>
          <label>Last menstrual cycle</label>
          <input
            type="date"
            value={form.lastCycleDate}
            onChange={(e) => updateField("lastCycleDate", e.target.value)}
          />
          <label>Fertile window (your estimate)</label>
          <input
            value={form.ovulationWindow}
            onChange={(e) => updateField("ovulationWindow", e.target.value)}
          />
          <label>Symptoms</label>
          <input
            value={form.symptoms}
            onChange={(e) => updateField("symptoms", e.target.value)}
          />
          <label>Private notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />
          <button type="button" onClick={() => void saveRecord()}>
            <Lock size={15} /> Save encrypted record
          </button>
          {recordId && (
            <div className="saved-badge">
              <CheckCircle size={14} /> Record saved securely
            </div>
          )}
        </div>

        {/* Right: Share */}
        <div className="card">
          <div className="section-title">
            <Share2 size={17} /> Share with your doctor
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            Send a secure link to your doctor. You control how many times they
            can open it — after that, the link expires automatically.
          </p>

          {!recordId ? (
            <div className="placeholder-hint">
              Save your record first, then share it here.
            </div>
          ) : (
            <>
              <label>How many times can the doctor open this?</label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxOpens}
                onChange={(e) =>
                  setMaxOpens(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <p className="hint">
                After {maxOpens} successful view
                {maxOpens > 1 ? "s" : ""}, the link stops working
                automatically.
              </p>

              {!shareLink ? (
                <button type="button" onClick={() => void generateLink()}>
                  <Link2 size={15} /> Generate access link
                </button>
              ) : (
                <div className="share-link-box">
                  <div className="share-link-label">
                    <CheckCircle size={14} /> Link ready — send this to your
                    doctor
                  </div>
                  <div className="share-link-url">{shareLink}</div>
                  <div className="share-link-actions">
                    <button
                      type="button"
                      className="btn-inline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(shareLink);
                          showToast("Link copied to clipboard!");
                        } catch {
                          showToast("Select and copy the link manually.");
                        }
                      }}
                    >
                      <Copy size={13} /> Copy link
                    </button>
                    <button
                      type="button"
                      className="btn-inline-danger"
                      onClick={() => void revokeAccess()}
                    >
                      <XCircle size={13} /> Revoke access
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Activity log */}
      <section className="card audit-section">
        <div className="audit-head">
          <div className="section-title" style={{ margin: 0 }}>
            <ClipboardList size={17} /> Activity log
          </div>
          <button
            type="button"
            className="btn-inline"
            onClick={() => {
              clearAuditLog();
              syncAudit();
            }}
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>
        <p className="hint">
          Every action is logged here. In production, consent events are
          recorded on Solana for tamper-proof auditability.
        </p>
        {auditTrail.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No activity yet.
          </p>
        ) : (
          <ul className="audit-list">
            {auditTrail.map((ev) => (
              <li key={ev.id} className="audit-item">
                <div className="audit-row">
                  <span className="audit-type">{formatType(ev.type)}</span>
                  <time
                    className="audit-time"
                    dateTime={new Date(ev.ts).toISOString()}
                  >
                    {new Date(ev.ts).toLocaleString()}
                  </time>
                </div>
                <p className="audit-meta">
                  {ev.walletShort ?? "—"} · record <code>{ev.recordId}</code>
                </p>
                <p className="audit-summary">{ev.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PatientApp />
  </React.StrictMode>,
);
