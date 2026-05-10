import React from "react";
import { createRoot } from "react-dom/client";
import {
  Shield,
  Eye,
  EyeOff,
  ClipboardList,
  Trash2,
  Stethoscope,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import "./styles.css";
import { decryptJson } from "./crypto";
import { hasAccessDemo, consumeOpenDemo } from "./permissionsDemo";
import {
  appendAuditEvent,
  clearAuditLog,
  readAuditLog,
  type AuditEvent,
} from "./auditLog";
import { decodeConsultShareCode } from "./shareCode";
import { useAuth } from "./useAuth";

type FertilityRecord = {
  lastCycleDate: string;
  ovulationWindow: string;
  symptoms: string;
  notes: string;
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

function friendlyDenial(reason: string): string {
  const map: Record<string, string> = {
    no_permission:
      "This link is not yet active. Ask the patient to generate a new access link.",
    permission_revoked: "The patient has revoked access to this record.",
    attempts_exhausted:
      "This link has reached its maximum number of views. Ask the patient for a new link.",
  };
  return map[reason] ?? `Access unavailable (${reason}).`;
}

function DoctorApp() {
  const { authenticated, wallet, displayName, login, logout } = useAuth();
  const [nameInput, setNameInput] = React.useState("");

  // Read the consult code from URL ?c= on first render
  const [consultCode] = React.useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("c") ?? "";
  });
  const hasLinkCode = !!consultCode;

  const [doctorView, setDoctorView] =
    React.useState<FertilityRecord | null>(null);
  const [denied, setDenied] = React.useState("");
  const [auditTrail, setAuditTrail] = React.useState<AuditEvent[]>(() =>
    readAuditLog(),
  );
  const [toast, setToast] = React.useState("");

  function syncAudit() {
    setAuditTrail(readAuditLog());
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function viewRecord() {
    setDenied("");
    try {
      const code = consultCode.trim();
      if (!code) {
        showToast("No access link found. Ask the patient to send you a link.");
        return;
      }

      const parsed = decodeConsultShareCode(code);
      if (!parsed) {
        showToast("Invalid or corrupted access link.");
        return;
      }

      const { recordId: rid, secret: decryptSecret } = parsed;

      // Permission is tied to the link token, not to a specific identity
      const permission = hasAccessDemo({ doctor: "shared-link", recordId: rid });
      if (!permission.ok) {
        const reason = (permission as { ok: false; reason: string }).reason;
        setDenied(friendlyDenial(reason));
        appendAuditEvent({
          type: "view_denied",
          recordId: rid,
          summary: `Access denied: ${reason}.`,
          actorRole: "doctor",
          walletShort: displayName,
        });
        syncAudit();
        return;
      }

      const decrypted = await decryptJson<FertilityRecord>(
        parsed.encryptedPayload,
        decryptSecret,
      );
      setDoctorView(decrypted);
      consumeOpenDemo({ doctor: "shared-link", recordId: rid });
      appendAuditEvent({
        type: "view_succeeded",
        recordId: rid,
        summary: "Record decrypted and displayed. 1 view consumed from the quota.",
        actorRole: "doctor",
        walletShort: displayName,
      });
      syncAudit();
      showToast("Record decrypted successfully.");
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
            <div className="login-icon doctor">
              <Stethoscope size={28} />
            </div>
            <h2 className="login-title">
              {hasLinkCode ? "A patient shared a record with you" : "Doctor sign-in"}
            </h2>
            <p className="login-sub">
              {hasLinkCode
                ? "Sign in with your name to decrypt and view the record securely in your browser."
                : "Sign in with your name to access authorized patient records."}
            </p>
            <label>Your name</label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Dr. Ramírez"
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
              Sign in
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
            <Stethoscope size={13} /> {displayName}
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

      <div className="doctor-single">
        {/* Invite banner / no-link warning */}
        {hasLinkCode ? (
          <div className="invite-banner">
            <Shield size={16} />
            <div>
              <strong>A patient shared their health record with you.</strong>
              <span>
                Click "View record" to decrypt and display it securely in your
                browser.
              </span>
            </div>
          </div>
        ) : (
          <div className="banner-demo">
            <AlertCircle size={16} />
            <span>
              No access link detected. Ask the patient to send you a Vitaseed
              link.
            </span>
          </div>
        )}

        {/* View button — only shown before record is loaded */}
        {!doctorView && !denied && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="section-title">
              <Eye size={17} /> Patient record
            </div>
            <p className="hint" style={{ marginTop: 6 }}>
              The record will be decrypted locally in your browser. No data
              passes through any server.
            </p>
            <button
              type="button"
              disabled={!hasLinkCode}
              onClick={() => void viewRecord()}
            >
              <Eye size={15} /> View record
            </button>
          </div>
        )}

        {/* Access denied */}
        {denied && (
          <div className="card denied-card" style={{ marginTop: 20 }}>
            <div
              className="section-title"
              style={{ color: "var(--danger)" }}
            >
              <EyeOff size={17} /> Access unavailable
            </div>
            <p style={{ marginTop: 10, color: "var(--text-muted)" }}>
              {denied}
            </p>
          </div>
        )}

        {/* Decrypted record */}
        {doctorView && (
          <div className="card" style={{ marginTop: 20 }}>
            <div
              className="section-title"
              style={{ color: "var(--success)" }}
            >
              <CheckCircle size={17} /> Patient's health record
            </div>
            <div className="result">
              <div className="result-row">
                <span className="result-key">Last cycle</span>
                <span className="result-val">{doctorView.lastCycleDate}</span>
              </div>
              <div className="result-row">
                <span className="result-key">Fertile window</span>
                <span className="result-val">
                  {doctorView.ovulationWindow}
                </span>
              </div>
              <div className="result-row">
                <span className="result-key">Symptoms</span>
                <span className="result-val">{doctorView.symptoms}</span>
              </div>
              <div className="result-row">
                <span className="result-key">Notes</span>
                <span className="result-val">{doctorView.notes}</span>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 14 }}>
              <Shield size={12} /> Decrypted locally. One view consumed from
              the patient's quota.
            </p>
          </div>
        )}

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
                    {ev.walletShort ?? "—"} · record{" "}
                    <code>{ev.recordId}</code>
                  </p>
                  <p className="audit-summary">{ev.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DoctorApp />
  </React.StrictMode>,
);
