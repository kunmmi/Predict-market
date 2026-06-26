-- Real-time support chat between users and admins.
--
-- One conversation per user, keyed by profile_id. Each message has a
-- sender_role ('user' | 'admin'). Inserts are performed server-side via
-- service-role API routes (which set the fields authoritatively), so no
-- client INSERT policy is granted. Clients only SELECT (for initial load +
-- Realtime), gated by RLS: a user sees only their own thread; admins see all.

CREATE TABLE IF NOT EXISTS public.support_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role       text NOT NULL CHECK (sender_role IN ('user', 'admin')),
  sender_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body              text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_by_admin     boolean NOT NULL DEFAULT false,
  read_by_user      boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_profile_created
  ON public.support_messages (profile_id, created_at);

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- A user can read the messages in their own conversation.
DROP POLICY IF EXISTS support_messages_select_own ON public.support_messages;
CREATE POLICY support_messages_select_own ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_user_id = auth.uid() AND p.id = support_messages.profile_id
    )
  );

-- An admin can read every conversation.
DROP POLICY IF EXISTS support_messages_select_admin ON public.support_messages;
CREATE POLICY support_messages_select_admin ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Broadcast row changes over the supabase_realtime publication (RLS still
-- applies to what each subscriber actually receives).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END $$;
