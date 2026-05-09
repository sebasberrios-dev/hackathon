import React from "react";
import { createRoot } from "react-dom/client";
import {
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  Heart,
  ArrowDown,
  ChevronRight,
  ClipboardList,
  Trash2,
} from "lucide-react";
import "./styles.css";
import { encryptJson, decryptJson } from "./crypto";
import { connectPhantom, getWalletAddress } from "./wallet";
import {
  grantAccessDemo,
  revokeAccessDemo,
  hasAccessDemo,
} from "./permissionsDemo";
import {
  appendAuditEvent,
  clearAuditLog,
  readAuditLog,
  type AuditEvent,
} from "./auditLog";

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

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function App() {
  const [wallet, setWallet] = React.useState("");
  const [doctorWallet, setDoctorWallet] = React.useState("");
  const [recordId, setRecordId] = React.useState("");
  const [secret, setSecret] = React.useState("demo-secret-123");
  const [minutes, setMinutes] = React.useState(5);
  const [status, setStatus] = React.useState(
    "Ready — connect Phantom to anchor your decentralized identity for this demo.",
  );
  const [doctorView, setDoctorView] = React.useState<FertilityRecord | null>(
    null,
  );
  const [auditTrail, setAuditTrail] = React.useState<AuditEvent[]>(() =>
    readAuditLog(),
  );
  const [form, setForm] = React.useState<FertilityRecord>({
    lastCycleDate: "2026-05-03",
    ovulationWindow: "May 15–20",
    symptoms: "mild cramps, headache",
    notes: "Private fertility note for demo only",
  });

  function syncAudit() {
    setAuditTrail(readAuditLog());
  }

  async function connectWallet() {
    try {
      const address = await connectPhantom();
      setWallet(address);
      setStatus(`Signed in as ${short(address)}`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function saveRecord() {
    try {
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) throw new Error("Please connect your wallet first.");

      const encryptedPayload = await encryptJson(form, secret);

      const response = await fetch(`${API_URL}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerWallet: currentWallet, encryptedPayload }),
      });

      if (!response.ok)
        throw new Error(
          "Could not save your entry. Is the server running?",
        );

      const saved: StoredRecord = await response.json();
      setRecordId(saved.id);
      appendAuditEvent({
        type: "record_sealed",
        recordId: saved.id,
        summary:
          "Encrypted fertility data saved off-chain — never uploaded as plaintext.",
        actorRole: "patient",
        walletShort: short(currentWallet),
      });
      syncAudit();
      setStatus(
        `Saved securely. Your record code is ${saved.id} — grant timed consent in step 2 when you're ready.`,
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function grantAccess() {
    try {
      const rid = recordId.trim();
      if (!rid) throw new Error("Save your health entry in step 1 first.");
      if (!doctorWallet.trim())
        throw new Error("Add the care provider's ID from step 2.");
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) throw new Error("Please connect as the patient first.");

      const expiresAt = Math.floor(Date.now() / 1000) + minutes * 60;

      grantAccessDemo({
        patient: currentWallet,
        doctor: doctorWallet.trim(),
        recordId: rid,
        expiresAt,
      });

      appendAuditEvent({
        type: "consent_granted",
        recordId: rid,
        summary: `Timed consent for clinician ${short(doctorWallet.trim())} (${minutes} min). MVP: stored locally; Solana will prove consent on-chain.`,
        actorRole: "patient",
        walletShort: short(currentWallet),
      });
      syncAudit();

      setStatus(
        `Consent granted for ${minutes} minute(s) — clinician can request access in step 3. Check the audit trail below.`,
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function revokeAccess() {
    try {
      const rid = recordId.trim();
      if (!rid || !doctorWallet.trim())
        throw new Error("You need a record code and the care provider's ID.");
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) throw new Error("Please connect as the patient first.");

      revokeAccessDemo({
        patient: currentWallet,
        doctor: doctorWallet.trim(),
        recordId: rid,
      });
      appendAuditEvent({
        type: "consent_revoked",
        recordId: rid,
        summary:
          "Patient revoked clinician access — further views should be denied until new consent.",
        actorRole: "patient",
        walletShort: short(currentWallet),
      });
      syncAudit();
      setDoctorView(null);
      setStatus(
        "Consent revoked — audit trail updated. Clinician access is blocked for this record.",
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function doctorReadRecord() {
    try {
      const rid = recordId.trim();
      if (!rid) throw new Error("Enter the record code the patient shared.");
      const currentDoctorWallet = wallet || (await getWalletAddress());
      if (!currentDoctorWallet)
        throw new Error("Please connect as the care provider.");

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
          summary: `View denied: ${auditDenialReason(reason)}.`,
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
          summary: "View denied: record not found on server.",
          actorRole: "doctor",
          walletShort: short(currentDoctorWallet),
        });
        syncAudit();
        throw new Error("That record code was not found.");
      }

      const record: StoredRecord = await response.json();
      const decrypted = await decryptJson<FertilityRecord>(
        record.encryptedPayload,
        secret,
      );
      setDoctorView(decrypted);
      appendAuditEvent({
        type: "view_succeeded",
        recordId: rid,
        summary:
          "Clinician decrypted data locally after valid consent — ciphertext never exposed on-chain.",
        actorRole: "doctor",
        walletShort: short(currentDoctorWallet),
      });
      syncAudit();
      setStatus(
        "Consent valid — data decrypted on this device only. Logged in audit trail.",
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  function updateField(key: keyof FertilityRecord, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function copyRecordCode() {
    const code = recordId.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setStatus(
        "Record code copied — you can paste it for the care provider if needed.",
      );
    } catch {
      setStatus("Could not copy — select the code and copy manually.");
    }
  }

  return (
    <div className="shell">
      <div className="scroll-progress" aria-hidden="true">
        <div className="scroll-progress__fill" />
      </div>

      <header className="site-nav">
        <div className="site-nav__brand">
          <span className="site-nav__brand-mark" aria-hidden>
            <Heart size={18} fill="currentColor" strokeWidth={0} />
          </span>
          FemVault
        </div>
        <nav className="site-nav__links" aria-label="Primary">
          <button type="button" onClick={() => scrollToId("story")}>
            Why FemVault
          </button>
          <button type="button" onClick={() => scrollToId("how")}>
            How it works
          </button>
          <button type="button" onClick={() => scrollToId("demo")}>
            Try the demo
          </button>
          <button type="button" onClick={() => scrollToId("audit")}>
            Audit trail
          </button>
          <button
            type="button"
            className="nav-cta"
            onClick={() => {
              void connectWallet();
              scrollToId("demo");
            }}
          >
            Connect Phantom
          </button>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-hero__content scroll-hero-text">
          <div className="landing-hero__tag">
            <Sparkles size={14} /> Own your data · Solana-ready
          </div>
          <h1 id="hero-title">
            Fertility data that stays <em>yours</em>
          </h1>
          <p className="landing-hero__lead">
            Typical fertility apps hoard intimate signals and monetize them —
            you rarely get real control. FemVault turns that around: you decide
            who sees what, you grant doctors{" "}
            <strong>timed consent</strong>, and every access leaves a trail.
            Medical notes stay encrypted off-chain; Solana is for{" "}
            <strong>verifiable consent</strong>, audit history, and wallet
            identity — never raw medical records on-chain.
          </p>
          <div className="landing-hero__actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void connectWallet();
                scrollToId("demo");
              }}
            >
              Connect &amp; try it <ChevronRight size={18} />
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => scrollToId("how")}
            >
              See how it works
            </button>
          </div>
          <p className="landing-hero__hint">
            {wallet ? (
              <>
                <strong>Signed in:</strong>{" "}
                <span title={wallet}>{short(wallet)}</span> — scroll down to
                run the guided demo.
              </>
            ) : (
              <>
                <strong>No wallet yet?</strong> Install Phantom, then tap
                connect — the flow below takes under two minutes.
              </>
            )}
          </p>
          <div className="scroll-cue" aria-hidden>
            <ArrowDown size={18} />
            Scroll
          </div>
        </div>

        <div className="landing-hero__visual scroll-hero-visual">
          <div className="hero-blob hero-blob--1" aria-hidden />
          <div className="hero-blob hero-blob--2" aria-hidden />
          <div className="hero-card">
            <p className="hero-card__title">What goes where</p>
            <div className="hero-card__rows">
              <div className="hero-card__row">
                <span>Medical notes</span>
                <span>Encrypted off-chain</span>
              </div>
              <div className="hero-card__row">
                <span>Solana (next)</span>
                <span>Consent · audit · DID</span>
              </div>
              <div className="hero-card__row">
                <span>Doctor access</span>
                <span>Your timed permission</span>
              </div>
            </div>
            <div className="hero-card__spark">
              <Shield size={14} /> MVP frontend — same flows wire to Anchor when
              you deploy.
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="section-story">
        <div className="section-story__inner reveal-scroll">
            <h2>Ownership, not surveillance</h2>
            <p>
              Many fertility products collect deeply personal data with opaque
              policies — especially concerning where reproductive rights are
              under pressure. FemVault is built on a different contract:{" "}
              <strong>you own your narrative</strong>, you choose who gets a
              window into it, and <strong>every access attempt is logged</strong>
              . Blockchain is the trust layer for consent and audit — not a
              database for intimate medical detail.
            </p>
            <div className="story-stats">
              <div className="story-stat">
                <div className="story-stat__num">You</div>
                <div className="story-stat__label">
                  Hold the keys to encrypted data; revoke clinician access anytime
                </div>
              </div>
              <div className="story-stat">
                <div className="story-stat__num">Time-box</div>
                <div className="story-stat__label">
                  Grant doctors temporary consent — not open-ended surveillance
                </div>
              </div>
              <div className="story-stat">
                <div className="story-stat__num">Audit</div>
                <div className="story-stat__label">
                  See who tried to view data (MVP local → Solana-backed later)
                </div>
              </div>
            </div>
          </div>
      </section>

      <section id="how" className="section-how">
          <div className="section-how__head reveal-scroll">
            <h2>How the MVP works</h2>
            <p>
              Three steps mirror the real product promise — plus an audit trail
              so “who accessed what” is never a black box.
            </p>
          </div>
          <div className="how-grid">
            <article className="how-card how-card--scroll">
              <div className="how-card__step">1</div>
              <h3>Seal your health entry</h3>
              <p>
                Add cycle data and notes. Everything is encrypted in your
                browser before any server sees it —{" "}
                <strong>no plaintext fertility data stored</strong> by design.
              </p>
            </article>
            <article className="how-card how-card--scroll">
              <div className="how-card__step">2</div>
              <h3>Grant timed consent</h3>
              <p>
                Paste your clinician&apos;s wallet and how long they may view
                this record. That&apos;s <strong>delegated access</strong>, not
                ownership transfer — Solana will eventually anchor this consent.
              </p>
            </article>
            <article className="how-card how-card--scroll">
              <div className="how-card__step">3</div>
              <h3>Access under audit</h3>
              <p>
                The clinician only decrypts after consent checks pass. Allow and
                deny events appear in the <strong>audit trail</strong> — the same
                signal you&apos;ll mirror on-chain for tamper-evident history.
              </p>
            </article>
          </div>
      </section>

      <section id="demo" className="section-demo">
          <div className="section-demo__intro reveal-scroll">
            <h2>Interactive workspace</h2>
            <p>
              Walk through ownership end-to-end: seal data, grant or revoke
              clinician consent, then verify access — every step logs to the{" "}
              <strong>audit trail</strong> below (browser-only for this MVP).
            </p>
          </div>

          <div className="demo-grid">
            <div className="card demo-card-scroll">
              <h2>
                <Lock size={20} strokeWidth={2.25} /> 1. You — seal your data
              </h2>
              <p className="helper" style={{ marginTop: 12 }}>
                You stay the owner: notes are encrypted here before upload. The
                server only ever sees ciphertext.
              </p>
              <label>Last period start date</label>
              <input
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
              <label>Shared passphrase (demo only)</label>
              <p className="helper">
                For this prototype, you and your care provider type the same
                phrase to unlock the data. A real product would handle this
                automatically.
              </p>
              <input value={secret} onChange={(e) => setSecret(e.target.value)} />
              <button type="button" onClick={() => void saveRecord()}>
                Save my encrypted entry
              </button>
              <label style={{ marginTop: 18 }}>Your record code</label>
              <p className="helper">
                Short code for this saved entry — use it in step 3 if the care
                provider opens the app on another device.
              </p>
              <div className="record-row">
                <span className="pill" title={recordId || undefined}>
                  {recordId || "— save first —"}
                </span>
                {recordId ? (
                  <button
                    type="button"
                    className="btn-inline"
                    onClick={() => void copyRecordCode()}
                  >
                    Copy code
                  </button>
                ) : null}
              </div>
            </div>

            <div className="card demo-card-scroll">
              <h2>
                <Unlock size={20} strokeWidth={2.25} /> 2. You — timed consent
              </h2>
              <p className="helper" style={{ marginTop: 12 }}>
                Decide <strong>who</strong> may read this record and{" "}
                <strong>for how long</strong>. Revoke anytime — consent is yours,
                not the app&apos;s.
              </p>
              <label>Clinician&apos;s wallet (decentralized ID)</label>
              <p className="helper">
                Phantom → copy address → paste here. Used only to enforce
                permission — <strong>no medical payload</strong> goes to
                Solana in this MVP (Anchor will store consent proofs later).
              </p>
              <input
                value={doctorWallet}
                onChange={(e) => setDoctorWallet(e.target.value.trim())}
                placeholder="Paste the long code from Phantom"
                autoComplete="off"
                spellCheck={false}
              />
              {doctorWallet.length > 12 ? (
                <div className="address-preview" title={doctorWallet}>
                  Sharing with: <strong>{short(doctorWallet)}</strong>
                </div>
              ) : null}
              <label>How long should access last?</label>
              <input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
              <p className="helper">Minutes until access expires automatically.</p>
              <button type="button" onClick={() => void grantAccess()}>
                Allow access
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => void revokeAccess()}
              >
                Remove access
              </button>
              <p className="hint">
                <strong>Demo tip:</strong> use two Phantom accounts — one as
                patient, one as care provider — or two browsers, so you can test
                the full flow yourself.
              </p>
            </div>

            <div className="card doctor demo-card-scroll">
              <h2>
                <Eye size={20} strokeWidth={2.25} /> 3. Clinician — view if
                consented
              </h2>
              <p className="helper" style={{ marginTop: 12 }}>
                Switch Phantom to the clinician identity. Decryption only runs if
                consent is valid — denied attempts are{" "}
                <strong>audited</strong> like allowed ones.
              </p>
              <label>Record code</label>
              <p className="helper">
                Usually filled in automatically after step 1; edit only if
                you&apos;re on another device.
              </p>
              <input
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                placeholder="e.g. KbYzFJA7UU"
              />
              <button type="button" onClick={() => void doctorReadRecord()}>
                View patient entry
              </button>
              {doctorView ? (
                <div className="result">
                  <p>
                    <b>Last period:</b> {doctorView.lastCycleDate}
                  </p>
                  <p>
                    <b>Fertile window:</b> {doctorView.ovulationWindow}
                  </p>
                  <p>
                    <b>Symptoms:</b> {doctorView.symptoms}
                  </p>
                  <p>
                    <b>Notes:</b> {doctorView.notes}
                  </p>
                </div>
              ) : (
                <div className="blocked">
                  <EyeOff size={18} /> Nothing to show yet — the patient must
                  allow access in step 2, and your passphrase must match theirs.
                </div>
              )}
            </div>
          </div>

          <div className="status-bar reveal-scroll reveal-scroll--footer">
            <b>Status:</b> {status}
          </div>

          <div id="audit" className="audit-panel reveal-scroll">
            <div className="audit-panel__header">
              <div>
                <h2 className="audit-panel__title">
                  <ClipboardList size={22} strokeWidth={2} aria-hidden />
                  Access audit trail
                </h2>
                <p className="audit-panel__lede">
                  Every save, consent change, successful view, and denied view
                  is recorded — that&apos;s the accountability layer your context
                  calls for. This MVP keeps the log in-browser; shipping Solana
                  makes it <strong>tamper-evident</strong> and globally
                  verifiable.
                </p>
              </div>
              <button
                type="button"
                className="audit-panel__clear"
                onClick={() => {
                  clearAuditLog();
                  syncAudit();
                  setStatus("Audit trail cleared for this demo session.");
                }}
              >
                <Trash2 size={16} aria-hidden />
                Clear demo log
              </button>
            </div>

            {auditTrail.length === 0 ? (
              <p className="audit-empty">
                No events yet. Save an encrypted record and grant consent — each
                action will appear here with a timestamp.
              </p>
            ) : (
              <ul className="audit-list">
                {auditTrail.map((ev) => (
                  <li key={ev.id} className="audit-item">
                    <div className="audit-item__top">
                      <time
                        className="audit-item__time"
                        dateTime={new Date(ev.ts).toISOString()}
                      >
                        {new Date(ev.ts).toLocaleString()}
                      </time>
                      <span
                        className={`audit-badge audit-badge--${ev.type}`}
                      >
                        {formatAuditType(ev.type)}
                      </span>
                    </div>
                    <p className="audit-item__meta">
                      <span className="audit-item__role">{ev.actorRole}</span>
                      {ev.walletShort ? (
                        <>
                          {" "}
                          · <span title={ev.walletShort}>{ev.walletShort}</span>
                        </>
                      ) : null}{" "}
                      · record <code className="audit-code">{ev.recordId}</code>
                    </p>
                    <p className="audit-item__summary">{ev.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
      </section>

      <footer className="site-footer">
        <p>
          <strong>FemVault</strong> — intimate fertility data encrypted
          off-chain; <strong>Solana</strong> for verifiable consent, access
          history, and decentralized identity —{" "}
          <strong>not</strong> for storing medical records on-chain.
        </p>
      </footer>
    </div>
  );
}

function short(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function auditDenialReason(reason: string): string {
  const map: Record<string, string> = {
    "no permission found": "no active consent for this wallet / record",
    "permission revoked": "patient revoked consent",
    "permission expired": "consent window expired",
  };
  return map[reason] ?? reason;
}

function formatAuditType(t: AuditEvent["type"]): string {
  const labels: Record<AuditEvent["type"], string> = {
    record_sealed: "Record sealed",
    consent_granted: "Consent granted",
    consent_revoked: "Consent revoked",
    view_succeeded: "View allowed",
    view_denied: "View denied",
  };
  return labels[t];
}

function friendlyDenial(reason: string): string {
  const map: Record<string, string> = {
    "no permission found":
      "Access not granted yet — ask the patient to allow access in step 2.",
    "permission revoked":
      "The patient removed access. They can allow it again if needed.",
    "permission expired":
      "This access window ended. Ask the patient to allow access again.",
  };
  return map[reason] ?? `Access not available (${reason}).`;
}

createRoot(document.getElementById("root")!).render(<App />);
