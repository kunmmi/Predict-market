"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, BellRing, X, Trophy, Clock, Zap } from "lucide-react";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import type { Locale } from "@/lib/i18n/translations";

interface AppNotification {
  id: string;
  type: "settlement_win" | "settlement_loss" | "match_reminder" | "market_live";
  title: string;
  body: string;
  market_id: string | null;
  data: { url?: string; marketId?: string };
  read_at: string | null;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_ICON: Record<AppNotification["type"], React.ReactNode> = {
  settlement_win:  <Trophy style={{ width: 13, height: 13 }} />,
  settlement_loss: <Zap    style={{ width: 13, height: 13 }} />,
  match_reminder:  <Clock  style={{ width: 13, height: 13 }} />,
  market_live:     <Zap    style={{ width: 13, height: 13 }} />,
};

const TYPE_COLOR: Record<AppNotification["type"], string> = {
  settlement_win:  "var(--gold)",
  settlement_loss: "var(--text-secondary)",
  match_reminder:  "#38bdf8",
  market_live:     "var(--green)",
};

export function NotificationBell({ locale }: { locale: Locale }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { permission, loading: subLoading, requestAndSubscribe } = usePushNotifications();

  const unread = notifications.filter((n) => !n.read_at).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Mark all as read when dropdown opens
  useEffect(() => {
    if (open && unread > 0) {
      fetch("/api/notifications/mark-read", { method: "POST" }).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      );
    }
  }, [open, unread]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasAny = notifications.length > 0;
  const Icon = unread > 0 ? BellRing : Bell;

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 8,
          border: `1px solid ${open ? "var(--border-strong)" : "var(--border-subtle)"}`,
          backgroundColor: open ? "var(--bg-elevated)" : "transparent",
          color: unread > 0 ? "var(--gold)" : "var(--text-secondary)",
          cursor: "pointer",
          transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: 15, height: 15 }} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 100,
              backgroundColor: "var(--gold)",
              color: "#070809",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
              pointerEvents: "none",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxHeight: 480,
            borderRadius: 12,
            border: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-surface)",
            boxShadow: "0 8px 32px var(--shadow-elevated)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 100,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-dim)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {locale === "zh" ? "通知" : "Notifications"}
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: 6,
                border: "none",
                backgroundColor: "transparent",
                color: "var(--text-dim)",
                cursor: "pointer",
              }}
            >
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>

          {/* Notification list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {!hasAny ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--text-dim)",
                  fontSize: "0.8125rem",
                }}
              >
                <Bell
                  style={{
                    width: 28,
                    height: 28,
                    margin: "0 auto 12px",
                    opacity: 0.3,
                    display: "block",
                  }}
                />
                {locale === "zh" ? "暂无通知" : "No notifications yet"}
              </div>
            ) : (
              notifications.map((n) => (
                <a
                  key={n.id}
                  href={n.data?.url ?? "/portfolio"}
                  onClick={() => setOpen(false)}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border-dim)",
                    textDecoration: "none",
                    backgroundColor: n.read_at ? "transparent" : "var(--gold-dim)",
                    transition: "background-color 150ms ease",
                    cursor: "pointer",
                  }}
                >
                  {/* Type icon */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: "var(--bg-elevated)",
                      border: `1px solid var(--border-subtle)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: TYPE_COLOR[n.type],
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {TYPE_ICON[n.type]}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: n.read_at ? 400 : 600,
                        color: "var(--text-primary)",
                        marginBottom: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {n.body}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--text-dim)",
                        marginTop: 4,
                      }}
                    >
                      {relativeTime(n.created_at)}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!n.read_at && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "var(--gold)",
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                  )}
                </a>
              ))
            )}
          </div>

          {/* Footer — push permission prompt */}
          {permission !== "granted" && (
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border-dim)",
                backgroundColor: "var(--bg-elevated)",
                flexShrink: 0,
              }}
            >
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                {locale === "zh"
                  ? "开启推送通知，第一时间获取比赛结果"
                  : "Enable push notifications to get match results instantly"}
              </p>
              <button
                onClick={requestAndSubscribe}
                disabled={subLoading || permission === "denied"}
                style={{
                  width: "100%",
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-gold)",
                  backgroundColor: "var(--gold-dim)",
                  color: "var(--gold)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: permission === "denied" ? "not-allowed" : "pointer",
                  opacity: permission === "denied" ? 0.5 : 1,
                  transition: "opacity 150ms ease",
                }}
              >
                {permission === "denied"
                  ? locale === "zh" ? "通知已被屏蔽" : "Notifications blocked"
                  : subLoading
                  ? locale === "zh" ? "开启中..." : "Enabling..."
                  : locale === "zh" ? "🔔 开启通知" : "🔔 Enable notifications"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
