/**
 * One-off script to set a user's role to "admin" by email.
 * Usage: npx tsx scripts/set-admin-role.ts
 */

import { config as dotenvConfig } from "dotenv";
import path from "path";

dotenvConfig({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TARGET_EMAIL = process.env.ADMIN_EMAIL ?? "bukunmiodukoya@gmail.com";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function main() {
  // 1. Look up the user by email via Supabase Auth admin API
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(TARGET_EMAIL)}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!listRes.ok) {
    console.error("Failed to look up user:", await listRes.text());
    process.exit(1);
  }

  const { users } = (await listRes.json()) as { users: { id: string; email: string }[] };
  const user = users?.find((u) => u.email === TARGET_EMAIL);

  if (!user) {
    console.error(`No user found with email: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (${user.id})`);

  // 2. Update the profiles table
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ role: "admin" }),
    },
  );

  if (!updateRes.ok) {
    console.error("Failed to update role:", await updateRes.text());
    process.exit(1);
  }

  const updated = await updateRes.json();
  console.log(`✅ Role set to "admin" for ${TARGET_EMAIL}`);
  console.log("Profile:", JSON.stringify(updated, null, 2));
}

void main().catch((err: unknown) => {
  console.error("Script failed:", err);
  process.exit(1);
});
