"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUser = {
  _id: Id<"users">;
  _creationTime: number;
  handle: string;
  email: string | null;
  avatar: string;
  isGuest: boolean;
  isAdmin: boolean;
  xp: number;
  matchesPlayed: number;
  wins: number;
  rating: number;
  createdAt: number;
};

type EditDraft = {
  handle: string;
  email: string;
  xp: number;
  wins: number;
  matchesPlayed: number;
  rating: number;
  isGuest: boolean;
  isAdmin: boolean;
};

type ActiveGame = {
  roomId: Id<"rooms">;
  code: string;
  gameId: string;
  createdAt: number;
  phase: string;
  round: number;
  players: { userId: Id<"users">; handle: string; avatar: string; score: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, set] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => set(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function useAdminToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(localStorage.getItem("arena15:admin-session"));
  }, []);
  return token;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ─── Cell input ───────────────────────────────────────────────────────────────

function CellInput({
  value,
  onChange,
  type = "text",
  width = 100,
  step,
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  width?: number;
  step?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width,
        padding: "3px 8px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        color: "#FBF7EE",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        outline: "none",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "#3DEEFF88";
        e.currentTarget.style.boxShadow = "0 0 0 2px #3DEEFF18";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  color,
  pulse,
}: {
  label: string;
  value: number | undefined;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 999,
        border: `1px solid ${color}44`,
        background: `${color}0D`,
        boxShadow: `0 0 14px ${color}22`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          animation: pulse ? "pulse 2s ease-in-out infinite" : "none",
          boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 14,
          color,
          minWidth: 16,
        }}
      >
        {value ?? "—"}
      </span>
      <span style={{ fontSize: 11, color: "#FBF7EE", opacity: 0.45 }}>{label}</span>
    </div>
  );
}

// ─── Active games section ─────────────────────────────────────────────────────

function ActiveGames({
  games,
  onForceEnd,
}: {
  games: ActiveGame[] | undefined;
  onForceEnd: (roomId: Id<"rooms">) => Promise<void>;
}) {
  const [endingId, setEndingId] = useState<string | null>(null);

  async function handleEnd(roomId: Id<"rooms">) {
    if (!confirm("Force-end this game?")) return;
    setEndingId(roomId);
    try {
      await onForceEnd(roomId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setEndingId(null);
    }
  }

  return (
    <div style={{ marginTop: 56 }}>
      <h2
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#3DFF8A",
          opacity: 0.6,
          marginBottom: 16,
        }}
      >
        Active Games
        {games && games.length > 0 && (
          <span
            style={{
              marginLeft: 8,
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(61,255,138,0.12)",
              border: "1px solid rgba(61,255,138,0.25)",
              color: "#3DFF8A",
              fontSize: 10,
            }}
          >
            {games.length}
          </span>
        )}
      </h2>

      {!games && (
        <div style={{ opacity: 0.3, display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "#FBF7EE" }}>
          <Spinner size={14} />
          Loading…
        </div>
      )}

      {games && games.length === 0 && (
        <div
          style={{
            padding: "28px 20px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.015)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "#FBF7EE",
            opacity: 0.3,
            textAlign: "center",
          }}
        >
          No active games right now
        </div>
      )}

      {games && games.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {games.map((game) => (
            <div
              key={game.roomId}
              style={{
                padding: "16px 20px",
                borderRadius: 10,
                border: "1px solid rgba(61,255,138,0.12)",
                background: "rgba(61,255,138,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#3DFF8A",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {game.code}
                  </span>
                  <span
                    style={{
                      marginLeft: 10,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "#FBF7EE",
                      opacity: 0.35,
                    }}
                  >
                    {game.gameId}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "#FBF7EE",
                    opacity: 0.4,
                  }}
                >
                  Round {game.round} · {game.phase}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {game.players.map((p) => (
                    <span
                      key={p.userId}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.04)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "#FBF7EE",
                        opacity: 0.7,
                      }}
                    >
                      <span>{p.avatar}</span>
                      {p.handle}
                      <span style={{ opacity: 0.5, marginLeft: 2 }}>{p.score}</span>
                    </span>
                  ))}
                </div>
              </div>

              <button
                disabled={endingId === game.roomId}
                onClick={() => handleEnd(game.roomId)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid rgba(239,68,68,0.28)",
                  background: "rgba(239,68,68,0.07)",
                  color: "#EF4444",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: endingId === game.roomId ? "default" : "pointer",
                  opacity: endingId === game.roomId ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (endingId !== game.roomId) {
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)";
                    e.currentTarget.style.background = "rgba(239,68,68,0.13)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.28)";
                  e.currentTarget.style.background = "rgba(239,68,68,0.07)";
                }}
              >
                {endingId === game.roomId && <Spinner size={12} color="#EF4444" />}
                Force End
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const adminToken = useAdminToken();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 200);

  const tokenArg = adminToken ?? "skip";

  const users = useQuery(
    api.admin.listUsers,
    tokenArg !== "skip"
      ? { sessionToken: tokenArg, search: debouncedSearch || undefined }
      : "skip",
  );
  const statsData = useQuery(
    api.admin.stats,
    tokenArg !== "skip" ? { sessionToken: tokenArg } : "skip",
  );
  const activeGames = useQuery(
    api.admin.listActiveGames,
    tokenArg !== "skip" ? { sessionToken: tokenArg } : "skip",
  );

  const updateUser = useMutation(api.admin.updateUser);
  const deleteUser = useMutation(api.admin.deleteUser);
  const forceEndGame = useMutation(api.admin.forceEndGame);

  function startEdit(user: AdminUser) {
    setEditingId(user._id);
    setEditDraft({
      handle: user.handle,
      email: user.email ?? "",
      xp: user.xp,
      wins: user.wins,
      matchesPlayed: user.matchesPlayed,
      rating: user.rating,
      isGuest: user.isGuest,
      isAdmin: user.isAdmin,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(userId: Id<"users">) {
    if (!editDraft || !adminToken) return;
    setSavingId(userId);
    try {
      await updateUser({
        sessionToken: adminToken,
        userId,
        handle: editDraft.handle,
        email: editDraft.email || null,
        xp: Number(editDraft.xp),
        wins: Number(editDraft.wins),
        matchesPlayed: Number(editDraft.matchesPlayed),
        rating: Number(editDraft.rating),
        isGuest: editDraft.isGuest,
        isAdmin: editDraft.isAdmin,
      });
      setEditingId(null);
      setEditDraft(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data ?? "Failed to save";
      alert(msg);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(userId: Id<"users">, handle: string) {
    if (!adminToken) return;
    if (!confirm(`Permanently delete "${handle}"? This cannot be undone.`)) return;
    setDeletingId(userId);
    try {
      await deleteUser({ sessionToken: adminToken, userId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data ?? "Failed to delete";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleForceEnd(roomId: Id<"rooms">) {
    if (!adminToken) return;
    await forceEndGame({ sessionToken: adminToken, roomId });
  }

  const isLoading = !adminToken || users === undefined;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .row-in { animation: fadeInUp 0.2s ease both; }
        .admin-tr { position: relative; }
        .admin-tr .row-actions { opacity: 0; transition: opacity 0.15s; }
        .admin-tr:hover .row-actions { opacity: 1; }
        .admin-tr.editing .row-actions { opacity: 1; }
        .cell-num { font-family: var(--font-mono); font-size: 13px; }
      `}</style>

      <div
        style={{
          minHeight: "calc(100vh - 52px)",
          padding: "48px 32px",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* ── Header ── */}
        <div style={{ marginBottom: 36 }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.25em",
              color: "#3DEEFF",
              opacity: 0.5,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            system · admin
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 400,
              color: "#FBF7EE",
              marginBottom: 24,
              letterSpacing: "0.01em",
            }}
          >
            User Management
          </h1>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <StatChip label="Total Users" value={statsData?.totalUsers} color="#3DEEFF" pulse />
            <StatChip label="Registered" value={statsData?.registered} color="#B85FFF" />
            <StatChip label="Guests" value={statsData?.guests} color="#FF8A3D" />
            <StatChip label="Sessions" value={statsData?.activeSessions} color="#3DFF8A" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "#3DEEFF",
                opacity: 0.4,
                letterSpacing: "0.1em",
                marginLeft: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#3DEEFF",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              LIVE
            </span>
          </div>
        </div>

        {/* ── Search ── */}
        <div style={{ marginBottom: 20, position: "relative", display: "inline-block" }}>
          <svg
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.3,
              pointerEvents: "none",
            }}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FBF7EE"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search handle or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: 36,
              paddingRight: 16,
              paddingTop: 9,
              paddingBottom: 9,
              width: 280,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "#FBF7EE",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              outline: "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3DEEFF55";
              e.currentTarget.style.boxShadow = "0 0 0 3px #3DEEFF10";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* ── Table ── */}
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Avatar", "Handle", "Email", "Type", "Admin", "XP", "Wins", "Matches", "Rating", "Joined", "Actions"].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "#FBF7EE",
                          opacity: 0.35,
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={11} style={{ padding: "64px 16px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          opacity: 0.4,
                          fontFamily: "var(--font-mono)",
                          fontSize: 13,
                          color: "#FBF7EE",
                        }}
                      >
                        <Spinner size={16} />
                        Loading users…
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && users.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: "80px 16px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 12,
                          opacity: 0.35,
                          color: "#FBF7EE",
                        }}
                      >
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <div>
                          <p style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                            No users found
                          </p>
                          <p style={{ fontSize: 12 }}>
                            {search ? "Try a different search term" : "The database is empty"}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  users.map((user, i) => {
                    const isEditing = editingId === user._id;
                    const isSaving = savingId === user._id;
                    const isDeleting = deletingId === user._id;
                    const isBusy = isSaving || isDeleting;

                    return (
                      <tr
                        key={user._id}
                        className={`admin-tr row-in ${isEditing ? "editing" : ""}`}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: isEditing ? "rgba(61,238,255,0.025)" : undefined,
                          opacity: isBusy ? 0.55 : 1,
                          transition: "background 0.15s, opacity 0.2s",
                          animationDelay: `${i * 20}ms`,
                          pointerEvents: isBusy ? "none" : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (!isEditing)
                            e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isEditing) e.currentTarget.style.background = "";
                        }}
                      >
                        {/* Avatar */}
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ fontSize: 22, lineHeight: 1 }}>{user.avatar}</span>
                        </td>

                        {/* Handle */}
                        <td style={{ padding: "10px 16px" }}>
                          {isEditing ? (
                            <CellInput
                              value={editDraft!.handle}
                              onChange={(v) => setEditDraft((d) => d ? { ...d, handle: v } : d)}
                              width={120}
                            />
                          ) : (
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "#FBF7EE" }}>
                              {user.handle}
                            </span>
                          )}
                        </td>

                        {/* Email */}
                        <td style={{ padding: "10px 16px" }}>
                          {isEditing ? (
                            <CellInput
                              value={editDraft!.email}
                              onChange={(v) => setEditDraft((d) => d ? { ...d, email: v } : d)}
                              type="email"
                              width={160}
                              placeholder="none"
                            />
                          ) : (
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 12,
                                color: "#FBF7EE",
                                opacity: user.email ? 0.55 : 0.25,
                                fontStyle: user.email ? "normal" : "italic",
                              }}
                            >
                              {user.email ?? "none"}
                            </span>
                          )}
                        </td>

                        {/* Type badge */}
                        <td style={{ padding: "10px 16px" }}>
                          {isEditing ? (
                            <button
                              onClick={() => setEditDraft((d) => d ? { ...d, isGuest: !d.isGuest } : d)}
                              style={{
                                padding: "3px 10px",
                                borderRadius: 999,
                                border: `1px solid ${editDraft!.isGuest ? "#FF8A3D55" : "#B85FFF55"}`,
                                background: editDraft!.isGuest ? "#FF8A3D18" : "#B85FFF18",
                                color: editDraft!.isGuest ? "#FF8A3D" : "#B85FFF",
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {editDraft!.isGuest ? "Guest" : "Registered"}
                            </button>
                          ) : (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 10px",
                                borderRadius: 999,
                                border: `1px solid ${user.isGuest ? "#FF8A3D44" : "#B85FFF44"}`,
                                background: user.isGuest ? "#FF8A3D12" : "#B85FFF12",
                                color: user.isGuest ? "#FF8A3D" : "#B85FFF",
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {user.isGuest ? "Guest" : "Reg"}
                            </span>
                          )}
                        </td>

                        {/* Admin */}
                        <td style={{ padding: "10px 16px" }}>
                          {isEditing ? (
                            <button
                              onClick={() => setEditDraft((d) => d ? { ...d, isAdmin: !d.isAdmin } : d)}
                              style={{
                                padding: "3px 10px",
                                borderRadius: 999,
                                border: `1px solid ${editDraft!.isAdmin ? "#3DEEFF55" : "rgba(255,255,255,0.12)"}`,
                                background: editDraft!.isAdmin ? "#3DEEFF18" : "rgba(255,255,255,0.04)",
                                color: editDraft!.isAdmin ? "#3DEEFF" : "#FBF7EE",
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                opacity: editDraft!.isAdmin ? 1 : 0.4,
                              }}
                            >
                              {editDraft!.isAdmin ? "Admin" : "—"}
                            </button>
                          ) : user.isAdmin ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 10px",
                                borderRadius: 999,
                                border: "1px solid #3DEEFF44",
                                background: "#3DEEFF12",
                                color: "#3DEEFF",
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              Admin
                            </span>
                          ) : (
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#FBF7EE", opacity: 0.2 }}>—</span>
                          )}
                        </td>

                        {/* XP */}
                        <td style={{ padding: "10px 16px" }}>
                          {isEditing ? (
                            <CellInput
                              value={editDraft!.xp}
                              onChange={(v) => setEditDraft((d) => d ? { ...d, xp: Number(v) } : d)}
                              type="number"
                              width={80}
                            />
                          ) : (
                            <span className="cell-num" style={{ color: "#3DEEFF", fontWeight: 700 }}>
                              {user.xp.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* Wins */}
                        <td style={{ padding: "10px 16px" }}>
                          {isEditing ? (
                            <CellInput
                              value={editDraft!.wins}
                              onChange={(v) => setEditDraft((d) => d ? { ...d, wins: Number(v) } : d)}
                              type="number"
                              width={64}
                            />
                          ) : (
                            <span className="cell-num" style={{ color: "#FBF7EE", opacity: 0.75 }}>
                              {user.wins}
                            </span>
                          )}
                        </td>

                        {/* Matches */}
                        <td style={{ padding: "10px 16px" }}>
                          {isEditing ? (
                            <CellInput
                              value={editDraft!.matchesPlayed}
                              onChange={(v) => setEditDraft((d) => d ? { ...d, matchesPlayed: Number(v) } : d)}
                              type="number"
                              width={64}
                            />
                          ) : (
                            <span className="cell-num" style={{ color: "#FBF7EE", opacity: 0.5 }}>
                              {user.matchesPlayed}
                            </span>
                          )}
                        </td>

                        {/* Rating */}
                        <td style={{ padding: "10px 16px" }}>
                          {isEditing ? (
                            <CellInput
                              value={editDraft!.rating}
                              onChange={(v) => setEditDraft((d) => d ? { ...d, rating: Number(v) } : d)}
                              type="number"
                              step="0.01"
                              width={72}
                            />
                          ) : (
                            <span className="cell-num" style={{ color: "#B85FFF" }}>
                              {user.rating.toFixed(2)}
                            </span>
                          )}
                        </td>

                        {/* Joined */}
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#FBF7EE", opacity: 0.35, whiteSpace: "nowrap" }}>
                            {fmt(user._creationTime)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "10px 16px" }}>
                          <div className="row-actions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {isEditing ? (
                              <>
                                {isSaving ? (
                                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 12, color: "#3DEEFF" }}>
                                    <Spinner color="#3DEEFF" />
                                    Saving…
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => saveEdit(user._id as Id<"users">)}
                                      style={{
                                        padding: "5px 14px",
                                        borderRadius: 6,
                                        border: "none",
                                        background: "#3DEEFF",
                                        color: "#07060B",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      style={{
                                        padding: "5px 12px",
                                        borderRadius: 6,
                                        border: "1px solid rgba(255,255,255,0.12)",
                                        background: "rgba(255,255,255,0.06)",
                                        color: "#FBF7EE",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        opacity: 0.7,
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {isDeleting ? (
                                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 12, color: "#FF5555" }}>
                                    <Spinner color="#FF5555" />
                                    Deleting…
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEdit(user)}
                                      style={{
                                        padding: "5px 12px",
                                        borderRadius: 6,
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        background: "rgba(255,255,255,0.05)",
                                        color: "#FBF7EE",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(user._id as Id<"users">, user.handle)}
                                      style={{
                                        padding: "5px 10px",
                                        borderRadius: 6,
                                        border: "1px solid rgba(239,68,68,0.25)",
                                        background: "rgba(239,68,68,0.06)",
                                        color: "#EF4444",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 12,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Del
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!isLoading && users.length > 0 && (
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "#FBF7EE",
                opacity: 0.28,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                {users.length} user{users.length !== 1 ? "s" : ""}
                {debouncedSearch ? ` matching "${debouncedSearch}"` : " total"}
              </span>
              <span>updates in real-time via Convex</span>
            </div>
          )}
        </div>

        {/* ── Active Games ── */}
        <ActiveGames
          games={adminToken ? (activeGames as ActiveGame[] | undefined) : []}
          onForceEnd={handleForceEnd}
        />
      </div>
    </>
  );
}
