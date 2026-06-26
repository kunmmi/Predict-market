"use client";

import * as React from "react";
import { Send, Loader2, Headset } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type SupportMessage = {
  id: string;
  profile_id: string;
  sender_role: "user" | "admin";
  sender_profile_id: string | null;
  body: string;
  created_at: string;
};

type Props = {
  /** Whose conversation thread this is (the user's profile id). */
  conversationProfileId: string;
  /** Is the current viewer an admin? Controls message alignment + send target. */
  isAdmin: boolean;
  locale: "en" | "zh";
  /** Optional header shown above the thread (used by the admin inbox). */
  headerName?: string;
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SupportChat({ conversationProfileId, isAdmin, locale, headerName }: Props) {
  const zh = locale === "zh";
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const seenIds = React.useRef<Set<string>>(new Set());

  const scrollToBottom = React.useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  const addMessage = React.useCallback((m: SupportMessage) => {
    if (seenIds.current.has(m.id)) return;
    seenIds.current.add(m.id);
    setMessages((prev) => [...prev, m].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)));
  }, []);

  async function markRead() {
    try {
      await fetch("/api/support/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: conversationProfileId }),
      });
    } catch { /* non-critical */ }
  }

  // Initial load
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    seenIds.current = new Set();
    setMessages([]);
    (async () => {
      try {
        const res = await fetch(`/api/support/messages?profileId=${conversationProfileId}`);
        const json = (await res.json()) as { messages?: SupportMessage[] };
        if (!active) return;
        for (const m of json.messages ?? []) {
          seenIds.current.add(m.id);
        }
        setMessages((json.messages ?? []).slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1)));
      } finally {
        if (active) { setLoading(false); scrollToBottom(); void markRead(); }
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationProfileId]);

  // Realtime subscription — new messages for this conversation
  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`support:${conversationProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `profile_id=eq.${conversationProfileId}`,
        },
        (payload) => {
          addMessage(payload.new as SupportMessage);
          scrollToBottom();
          void markRead();
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationProfileId]);

  // Fallback poll (safety net if Realtime delivery is delayed/blocked). Dedup by
  // id means this never double-counts what Realtime already delivered.
  React.useEffect(() => {
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/support/messages?profileId=${conversationProfileId}`);
        const json = (await res.json()) as { messages?: SupportMessage[] };
        let added = false;
        for (const m of json.messages ?? []) {
          if (!seenIds.current.has(m.id)) { addMessage(m); added = true; }
        }
        if (added) scrollToBottom();
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationProfileId]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, profileId: conversationProfileId }),
      });
      const json = (await res.json()) as { success?: boolean; message?: SupportMessage };
      if (json.success && json.message) {
        addMessage(json.message); // realtime will also fire; dedup by id
        scrollToBottom();
      } else {
        setDraft(body); // restore on failure
      }
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10">
          <Headset className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            {headerName ?? (zh ? "客服支持" : "Support")}
          </p>
          <p className="text-[11px] text-slate-500">
            {zh ? "我们通常几分钟内回复" : "We usually reply within minutes"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ minHeight: 320 }}>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Headset className="mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-400">
              {zh ? "发送消息开始对话" : "Send a message to start the conversation"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {zh ? "我们的团队会尽快回复您。" : "Our team will get back to you shortly."}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = isAdmin ? m.sender_role === "admin" : m.sender_role === "user";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-amber-400 text-slate-900 rounded-br-md"
                      : "bg-[#1a1d24] text-slate-100 border border-white/[0.06] rounded-bl-md"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-slate-800/70" : "text-slate-500"}`}>
                    {!mine && (m.sender_role === "admin" ? (zh ? "客服 · " : "Support · ") : "")}
                    {timeLabel(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={zh ? "输入消息…" : "Type a message…"}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-white/[0.08] bg-[#0c0e12] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
          />
          <button
            onClick={() => void send()}
            disabled={sending || draft.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-40"
            aria-label={zh ? "发送" : "Send"}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
