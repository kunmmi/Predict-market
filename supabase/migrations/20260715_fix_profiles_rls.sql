-- Fix privilege escalation: prevent users from changing their own role/id fields.
--
-- The previous "profiles_update_own" policy had no WITH CHECK clause, meaning any
-- authenticated user could call .update({ role: 'admin' }) on their own profile row
-- and the update would succeed. The anon key is public, so no special access was needed.
--
-- Fix: add WITH CHECK that pins role, id, and auth_user_id to their current values.
-- Service-role / admin operations bypass RLS entirely, so admin role-setting still works.

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (
  auth.uid() = auth_user_id
  AND role        = (SELECT role         FROM public.profiles WHERE auth_user_id = auth.uid())
  AND id          = (SELECT id           FROM public.profiles WHERE auth_user_id = auth.uid())
  AND auth_user_id = (SELECT auth_user_id FROM public.profiles WHERE auth_user_id = auth.uid())
);
