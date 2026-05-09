import React from "react";
import { createRoot } from "react-dom/client";
import { Shield, Lock, Unlock, Eye, EyeOff } from "lucide-react";
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

function App() {
  const [wallet, setWallet] = React.useState("");
  const [doctorWallet, setDoctorWallet] = React.useState("");
  const [recordId, setRecordId] = React.useState("");
  const [secret, setSecret] = React.useState("demo-secret-123");
  const [minutes, setMinutes] = React.useState(5);
  const [status, setStatus] = React.useState("Ready");
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
      setStatus(`Connected: ${short(address)}`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function saveRecord() {
    try {
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) throw new Error("Connect wallet first");

      const encryptedPayload = await encryptJson(form, secret);

      const response = await fetch(`${API_URL}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerWallet: currentWallet, encryptedPayload }),
      });

      if (!response.ok) throw new Error("Could not save record");

      const saved: StoredRecord = await response.json();
      setRecordId(saved.id);
      setStatus(`Record saved off-chain: ${saved.id}`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function grantAccess() {
    try {
      if (!recordId) throw new Error("Save a record first");
      if (!doctorWallet) throw new Error("Doctor wallet is required");
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) throw new Error("Connect patient wallet first");

      const expiresAt = Math.floor(Date.now() / 1000) + minutes * 60;

      // Hackathon default: local demo permission.
      // Replace this call with Anchor client call after deploying the program.
      grantAccessDemo({
        patient: currentWallet,
        doctor: doctorWallet,
        recordId,
        expiresAt,
      });

      setStatus(`Access granted to doctor for ${minutes} minute(s)`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function revokeAccess() {
    try {
      if (!recordId || !doctorWallet)
        throw new Error("recordId and doctor wallet are required");
      const currentWallet = wallet || (await getWalletAddress());
      if (!currentWallet) throw new Error("Connect patient wallet first");

      revokeAccessDemo({
        patient: currentWallet,
        doctor: doctorWallet,
        recordId,
      });
      setDoctorView(null);
      setStatus("Access revoked");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function doctorReadRecord() {
    try {
      if (!recordId) throw new Error("Record id is required");
      const currentDoctorWallet = wallet || (await getWalletAddress());
      if (!currentDoctorWallet) throw new Error("Connect doctor wallet first");

      const permission = hasAccessDemo({
        doctor: currentDoctorWallet,
        recordId,
      });

      if (!permission.ok) {
        setDoctorView(null);
        setStatus(
          `Access denied: ${(permission as { ok: false; reason: string }).reason}`,
        );
        return;
      }

      const response = await fetch(`${API_URL}/records/${recordId}`);
      if (!response.ok) throw new Error("Record not found");

      const record: StoredRecord = await response.json();
      const decrypted = await decryptJson<FertilityRecord>(
        record.encryptedPayload,
        secret,
      );
      setDoctorView(decrypted);
      setStatus("Doctor access approved. Data decrypted locally.");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  function updateField(key: keyof FertilityRecord, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="badge">
          <Shield size={16} /> Solana Privacy MVP
        </div>
        <h1>FemVault</h1>
        <p>
          Wallet de privacidad para datos de fertilidad: datos cifrados
          off-chain, permisos temporales verificables on-chain.
        </p>
        <button onClick={connectWallet}>Connect Phantom</button>
        <p className="muted">
          Wallet activa: {wallet ? short(wallet) : "Not connected"}
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>
            <Lock size={20} /> 1. Patient: save encrypted record
          </h2>
          <label>Last cycle date</label>
          <input
            value={form.lastCycleDate}
            onChange={(e) => updateField("lastCycleDate", e.target.value)}
          />
          <label>Ovulation window</label>
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
          <label>Demo encryption secret</label>
          <input value={secret} onChange={(e) => setSecret(e.target.value)} />
          <button onClick={saveRecord}>Save encrypted record</button>
          <p className="muted">Record ID: {recordId || "none yet"}</p>
        </div>

        <div className="card">
          <h2>
            <Unlock size={20} /> 2. Patient: grant / revoke access
          </h2>
          <label>Doctor wallet address</label>
          <input
            value={doctorWallet}
            onChange={(e) => setDoctorWallet(e.target.value)}
            placeholder="Paste doctor Phantom address"
          />
          <label>Access duration in minutes</label>
          <input
            type="number"
            min="1"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
          <button onClick={grantAccess}>Grant access</button>
          <button className="danger" onClick={revokeAccess}>
            Revoke access
          </button>
          <p className="hint">
            Tip demo: usa dos cuentas de Phantom, una paciente y una doctor.
          </p>
        </div>

        <div className="card doctor">
          <h2>
            <Eye size={20} /> 3. Doctor: read if permission is valid
          </h2>
          <label>Record ID to read</label>
          <input
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
          />
          <button onClick={doctorReadRecord}>Doctor: request access</button>
          {doctorView ? (
            <div className="result">
              <p>
                <b>Last cycle:</b> {doctorView.lastCycleDate}
              </p>
              <p>
                <b>Ovulation:</b> {doctorView.ovulationWindow}
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
              <EyeOff size={18} /> No data visible
            </div>
          )}
        </div>
      </section>

      <section className="status">
        <b>Status:</b> {status}
      </section>
    </main>
  );
}

function short(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

createRoot(document.getElementById("root")!).render(<App />);
