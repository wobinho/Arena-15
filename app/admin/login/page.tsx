"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const adminSignIn = useMutation(api.admin.adminSignIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await adminSignIn({ email, password });
      localStorage.setItem("arena15:admin-session", result.sessionToken);
      router.push("/admin/users");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { data?: string })?.data ?? "Sign-in failed";
      setError(msg.replace(/^Uncaught Error:\s*/i, ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#07060B",
        padding: "24px",
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .admin-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .admin-input:focus {
          outline: none;
          border-color: #3DEEFF88 !important;
          box-shadow: 0 0 0 3px #3DEEFF14;
        }
        .admin-btn:hover:not(:disabled) { opacity: 0.88; }
        .admin-btn:active:not(:disabled) { opacity: 0.72; }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
        }}
      >
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.3em",
              color: "#3DEEFF",
              opacity: 0.45,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            system · admin
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 400,
              color: "#FBF7EE",
              letterSpacing: "0.01em",
            }}
          >
            Arena 15
          </h1>
        </div>

        {/* Card */}
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.025)",
            padding: "32px 28px",
            backdropFilter: "blur(8px)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              color: "#FBF7EE",
              marginBottom: 24,
              letterSpacing: "0.04em",
            }}
          >
            Admin Sign In
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#FBF7EE",
                  opacity: 0.4,
                }}
              >
                Email
              </label>
              <input
                className="admin-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#FBF7EE",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#FBF7EE",
                  opacity: 0.4,
                }}
              >
                Password
              </label>
              <input
                className="admin-input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#FBF7EE",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.08)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "#EF4444",
                }}
              >
                {error}
              </div>
            )}

            <button
              className="admin-btn"
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                padding: "11px 0",
                borderRadius: 8,
                border: "none",
                background: loading ? "rgba(61,238,255,0.35)" : "#3DEEFF",
                color: "#07060B",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? "default" : "pointer",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 0.15s, opacity 0.15s",
              }}
            >
              {loading && (
                <svg
                  style={{ animation: "spin 0.8s linear infinite" }}
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              )}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
