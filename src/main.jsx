import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
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

  return (
    <main className="page">
      <section className="card">
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
            <button
              className="delete"
              aria-label="Clear"
              onClick={() => {
                setUrl("");
                setResult(null);
                setError("");
              }}
            >
              🗑
            </button>
          )}
        </div>

        <button className="find" disabled={loading} onClick={findId}>
          {loading ? "Finding..." : "Find now"}
        </button>

        {loading && (
          <div className="loading">
            <span className="spinner" />
            <span>Finding Facebook ID...</span>
          </div>
        )}

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

            <button className="copy" onClick={copyId}>
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
          The request is sent through the server, so your Apify API token is
          never exposed to visitors.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
