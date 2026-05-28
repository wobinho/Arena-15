"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setToken(localStorage.getItem("arena15:admin-session"));
  }, []);

  const session = useQuery(
    api.admin.verifyAdminSession,
    token && !isLoginPage ? { sessionToken: token } : "skip",
  );

  useEffect(() => {
    if (isLoginPage) return;
    if (token === undefined) return; // still loading from localStorage
    if (token === null) {
      router.replace("/admin/login");
      return;
    }
    if (session === null) {
      localStorage.removeItem("arena15:admin-session");
      router.replace("/admin/login");
    }
  }, [isLoginPage, token, session, router]);

  // Login page: always render immediately (no auth check needed)
  if (isLoginPage) return <>{children}</>;

  // Waiting for localStorage read or session verification
  if (token === undefined || (token !== null && session === undefined)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07060B",
        }}
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <svg
          style={{ animation: "spin 0.9s linear infinite", opacity: 0.3 }}
          width={28}
          height={28}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3DEEFF"
          strokeWidth="2"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
    );
  }

  // No token or invalid session — redirect in progress
  if (!token || session === null) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#07060B", color: "#FBF7EE" }}>
      {/* Top nav */}
      <nav
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 52,
          position: "sticky",
          top: 0,
          background: "#07060B",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              color: "#FBF7EE",
              letterSpacing: "0.02em",
            }}
          >
            Arena 15
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "#3DEEFF",
              opacity: 0.5,
              textTransform: "uppercase",
              borderLeft: "1px solid rgba(255,255,255,0.1)",
              paddingLeft: 16,
            }}
          >
            Admin
          </span>
          <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
            {[
              { label: "Users", href: "/admin/users" },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: pathname.startsWith(href) ? "#3DEEFF" : "#FBF7EE",
                  opacity: pathname.startsWith(href) ? 1 : 0.4,
                  textDecoration: "none",
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: pathname.startsWith(href)
                    ? "rgba(61,238,255,0.08)"
                    : "transparent",
                  transition: "opacity 0.15s",
                }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem("arena15:admin-session");
            router.push("/admin/login");
          }}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#FBF7EE",
            opacity: 0.3,
            background: "none",
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.1em",
            padding: "4px 0",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.3")}
        >
          Sign out
        </button>
      </nav>

      {children}
    </div>
  );
}
