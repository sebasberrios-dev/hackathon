import React from "react";
import { createRoot } from "react-dom/client";
import {
  Shield,
  User,
  Stethoscope,
  Lock,
  Zap,
  Eye,
  GitBranch,
} from "lucide-react";
import "./styles.css";

function Landing() {
  return (
    <div className="page">
      <nav className="top-bar">
        <div className="brand">
          <Shield size={18} />
          <span>VitaSeed</span>
        </div>
        <span className="role-pill">
          <span className="live-dot" />
          Live Demo
        </span>
      </nav>

      <div className="hero-wrapper">
        <div className="hero-badge">
          <span className="live-dot" />
          Privacy-first fertility wallet
        </div>

        <h1 className="hero-title">VitaSeed</h1>

        <p className="hero-sub">
          Your fertility data, encrypted client-side with AES-GCM. You control
          exactly how many times a doctor can open it — enforced by consent
          tokens on Solana.
        </p>

        <div className="role-picker">
          <a href="/patient.html" className="role-card">
            <div className="rc-icon">
              <User size={24} />
            </div>
            <span className="rc-label">Patient</span>
            <span className="rc-desc">
              Encrypt records &amp; grant timed access
            </span>
          </a>
          <a href="/doctor.html" className="role-card">
            <div className="rc-icon">
              <Stethoscope size={24} />
            </div>
            <span className="rc-label">Doctor</span>
            <span className="rc-desc">Decrypt authorized consults</span>
          </a>
        </div>

        <div className="feature-pills">
          <span className="pill">
            <Lock size={11} /> AES-GCM encrypted
          </span>
          <span className="pill">
            <Zap size={11} /> Client-side only
          </span>
          <span className="pill">
            <Eye size={11} /> Count-limited access
          </span>
          <span className="pill">
            <GitBranch size={11} /> Consent on Solana (soon)
          </span>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Landing />
  </React.StrictMode>,
);
