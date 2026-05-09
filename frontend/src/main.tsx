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
} from "lucide-react";
import "./styles.css";
import { encryptJson, decryptJson } from "./crypto";
import { connectPhantom, getWalletAddress } from "./wallet";
import {
  grantAccessDemo,
  revokeAccessDemo,
  hasAccessDemo,
} from "./permissionsDemo";

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
    "Ready — connect your wallet to begin.",
  );
  const [doctorView, setDoctorView] = React.useState<FertilityRecord | null>(
    null,
  );
  const [form, setForm] = React.useState<FertilityRecord>({
    lastCycleDate: "2026-05-03",
    ovulationWindow: "May 15–20",
    symptoms: "mild cramps, headache",
    notes: "Private fertility note for demo only",
  });

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
      setStatus(
        `Saved securely. Your record code is ${saved.id} — share access in step 2 when you're ready.`,
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

      setStatus(
        `Access granted for ${minutes} minute(s) — your care provider can open the record in step 3.`,
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
      setDoctorView(null);
      setStatus(
        "Access removed — the care provider can no longer open this record.",
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
        setStatus(
          friendlyDenial((permission as { ok: false; reason: string }).reason),
        );
        return;
      }

      const response = await fetch(`${API_URL}/records/${rid}`);
      if (!response.ok) throw new Error("That record code was not found.");

      const record: StoredRecord = await response.json();
      const decrypted = await decryptJson<FertilityRecord>(
        record.encryptedPayload,
        secret,
      );
      setDoctorView(decrypted);
      setStatus("Access approved — information shown only on this device.");
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
            <Sparkles size={14} /> Solana privacy lab
          </div>
          <h1 id="hero-title">
            Your cycle story, <em>fully yours</em>
          </h1>
          <p className="landing-hero__lead">
            FemVault encrypts sensitive fertility notes before they ever touch a
            server. Share timed access with a care provider — revoke it anytime.
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
            <p className="hero-card__title">Privacy snapshot</p>
            <div className="hero-card__rows">
              <div className="hero-card__row">
                <span>Data on-chain</span>
                <span>Consent only</span>
              </div>
              <div className="hero-card__row">
                <span>Notes storage</span>
                <span>AES-GCM + PBKDF2</span>
              </div>
              <div className="hero-card__row">
                <span>Access window</span>
                <span>You decide</span>
              </div>
            </div>
            <div className="hero-card__spark">
              <Shield size={14} /> Built for hackathon demos — designed like a
              2026 product.
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="section-story">
        <div className="section-story__inner reveal-scroll">
            <h2>Designed for calm, not complexity</h2>
            <p>
              Health data shouldn&apos;t feel like a spreadsheet of wallet
              strings. FemVault keeps the medical payload encrypted off-chain
              while Solana can anchor who is allowed to read — and until when —
              when you wire up the Anchor program.
            </p>
            <div className="story-stats">
              <div className="story-stat">
                <div className="story-stat__num">0</div>
                <div className="story-stat__label">
                  Plaintext fertility notes stored by design
                </div>
              </div>
              <div className="story-stat">
                <div className="story-stat__num">1-tap</div>
                <div className="story-stat__label">
                  Flow to grant or revoke access in the demo
                </div>
              </div>
              <div className="story-stat">
                <div className="story-stat__num">∞</div>
                <div className="story-stat__label">
                  Room to grow — UX first, chain as proof
                </div>
              </div>
            </div>
          </div>
      </section>

      <section id="how" className="section-how">
          <div className="section-how__head reveal-scroll">
            <h2>How the interactive demo works</h2>
            <p>
              Three gentle steps — save, share, verify — same screen, no tab
              gymnastics.
            </p>
          </div>
          <div className="how-grid">
            <article className="how-card how-card--scroll">
              <div className="how-card__step">1</div>
              <h3>Seal your entry</h3>
              <p>
                Add cycle details and notes. Everything is encrypted in your
                browser before upload.
              </p>
            </article>
            <article className="how-card how-card--scroll">
              <div className="how-card__step">2</div>
              <h3>Invite your clinician</h3>
              <p>
                Paste their wallet ID and choose how long access lasts. We show
                a friendly short preview so long addresses feel manageable.
              </p>
            </article>
            <article className="how-card how-card--scroll">
              <div className="how-card__step">3</div>
              <h3>They open when allowed</h3>
              <p>
                Switch Phantom to the care provider, match the record code and
                passphrase — see data only if permission is valid.
              </p>
            </article>
          </div>
      </section>

      <section id="demo" className="section-demo">
          <div className="section-demo__intro reveal-scroll">
            <h2>Try the live workspace</h2>
            <p>
              The cards below are fully functional — save a record, share
              access, then read as the clinician. Status updates appear at the
              bottom.
            </p>
          </div>

          <div className="demo-grid">
            <div className="card demo-card-scroll">
              <h2>
                <Lock size={20} strokeWidth={2.25} /> 1. Patient — save your
                entry
              </h2>
              <p className="helper" style={{ marginTop: 12 }}>
                Fill in your health details below. Nothing is stored in plain
                text.
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
                <Unlock size={20} strokeWidth={2.25} /> 2. Patient — share
                access
              </h2>
              <p className="helper" style={{ marginTop: 12 }}>
                Choose who may read this entry and for how long. We show a short
                ID so long wallet strings are easier to scan.
              </p>
              <label>Care provider&apos;s wallet ID</label>
              <p className="helper">
                In Phantom: open the menu → copy the address → paste here. We
                use it only to match permission — no medical data is sent
                on-chain in this demo.
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
                <Eye size={20} strokeWidth={2.25} /> 3. Care provider — open
                when allowed
              </h2>
              <p className="helper" style={{ marginTop: 12 }}>
                Connect as the care provider, enter the record code the patient
                shared, and use the same passphrase they used when saving.
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
      </section>

      <footer className="site-footer">
        <p>
          <strong>FemVault</strong> — fertility data stays encrypted off-chain;
          Solana-ready consent for your hackathon story.
        </p>
      </footer>
    </div>
  );
}

function short(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
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
