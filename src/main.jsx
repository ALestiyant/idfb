import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const tabs = [
  { id: "finder", label: "ID Finder" },
  { id: "check", label: "FB Check" }
];

function App() {
  const [activeTab, setActiveTab] = useState("finder");

  return (
    <main className="page">
      <nav className="nav card">
        <div className="brand">IDFB</div>
        <div className="tabs" role="tablist" aria-label="Tools">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "finder" ? <Finder /> : <FbCheck />}
    </main>
  );
}

function Finder() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function findId() {
    const value = url.trim();
    setError("");
    setResult(null);
    setCopied(false);

    if (!value) {
      setError("Masukkan URL Facebook terlebih dahulu.");
      return;
    }

    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      const allowed = [
        "facebook.com",
        "m.facebook.com",
        "web.facebook.com",
        "mbasic.facebook.com",
        "fb.com",
        "fb.watch"
      ];
      if (!allowed.some((h) => host === h || host.endsWith("." + h))) {
        throw new Error("Gunakan URL Facebook yang valid.");
      }
    } catch (e) {
      setError(e.message || "URL Facebook tidak valid.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Gagal mendapatkan Facebook ID.");
      }

      setResult(data);
    } catch (e) {
      setError(e.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  async function copyId() {
    if (!result?.id) return;
    try {
      await navigator.clipboard.writeText(result.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Gagal menyalin ID.");
    }
  }

  function clear() {
    setUrl("");
    setResult(null);
    setError("");
    setCopied(false);
  }

  return (
    <>
      <section className="card tool-card">
        <h1>Facebook ID Finder</h1>
        <label>Enter Facebook profile link</label>

        <div className="input-wrap">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && findId()}
            placeholder="https://www.facebook.com/username"
            autoComplete="off"
          />
          {url && (
            <button className="delete" aria-label="Clear" onClick={clear} type="button">
              ×
            </button>
          )}
        </div>

        <button className="find" disabled={loading} onClick={findId} type="button">
          {loading ? "Finding..." : "Find now"}
        </button>

        {loading && <Loading text="Finding Facebook ID..." />}
        {error && <div className="error">{error}</div>}

        {result && !loading && (
          <div className="result">
            {result.imageUrl && (
              <img
                className="avatar"
                src={result.imageUrl}
                alt="Facebook profile"
                referrerPolicy="no-referrer"
              />
            )}

            <div className="success">
              <span>Facebook ID:</span>
              <strong>{result.id}</strong>
            </div>

            <button className="copy" onClick={copyId} type="button">
              {copied ? "Copied!" : "Copy ID"}
            </button>

            {result.name && (
              <div className="meta">
                <b>{result.name}</b>
                {result.type ? <span>{result.type}</span> : null}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="info">
        <h2>Find your Facebook Profile User ID</h2>
        <p>
          Enter a public Facebook profile, page, group, post, video or reel URL.
          Your Apify API token stays on the server and is never exposed to visitors.
        </p>
      </section>
    </>
  );
}

function FbCheck() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function checkId() {
    const value = id.trim();
    setError("");
    setResult(null);

    if (!value) {
      setError("Masukkan Facebook ID terlebih dahulu.");
      return;
    }

    if (!/^\d{1,30}$/.test(value)) {
      setError("Facebook ID harus berupa angka saja.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: value })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Gagal memeriksa Facebook ID.");
      }

      setResult(data);
    } catch (e) {
      setError(e.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setId("");
    setResult(null);
    setError("");
  }

  const resultClass = result
    ? result.status === "ok"
      ? "check-success"
      : result.status === "login_required"
        ? "check-warning"
        : result.status === "not_found"
          ? "check-danger"
          : "check-error"
    : "";

  return (
    <>
      <section className="card tool-card">
        <h1>FB Check</h1>
        <label>Check Facebook account by ID</label>

        <div className="input-wrap">
          <input
            inputMode="numeric"
            value={id}
            onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && checkId()}
            placeholder="Contoh: 100044561550831"
            autoComplete="off"
          />
          {id && (
            <button className="delete" aria-label="Clear" onClick={clear} type="button">
              ×
            </button>
          )}
        </div>

        <button className="find" disabled={loading} onClick={checkId} type="button">
          {loading ? "Checking..." : "Check now"}
        </button>

        {loading && <Loading text="Checking Facebook ID..." />}
        {error && <div className="error">{error}</div>}

        {result && !loading && (
          <div className="check-result">
            {result.imageUrl && (
              <img
                className="avatar small"
                src={result.imageUrl}
                alt="Facebook profile"
                referrerPolicy="no-referrer"
              />
            )}

            <div className={`status-box ${resultClass}`}>
              <strong>{result.title}</strong>
              <span>{result.message}</span>
            </div>

            <div className="check-details">
              <div><span>Facebook ID</span><b>{result.id}</b></div>
              {result.name && <div><span>Name</span><b>{result.name}</b></div>}
              {result.type && <div><span>Type</span><b>{result.type}</b></div>}
            </div>
          </div>
        )}
      </section>

      <section className="info">
        <h2>What does FB Check mean?</h2>
        <p>
          <b>FOUND</b> means the Facebook ID can be resolved publicly. It does not mean
          the account owner is currently online.
        </p>
        <p>
          <b>RESTRICTED</b> means Facebook requires login or limits access, so the ID
          cannot be verified from a public request. This does not automatically mean
          the account is deleted.
        </p>
      </section>
    </>
  );
}

function Loading({ text }) {
  return (
    <div className="loading">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
