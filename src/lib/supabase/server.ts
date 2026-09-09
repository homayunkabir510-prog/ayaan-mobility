import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client, scoped to Storage use (odometer photos,
 * license images, expense receipts). Ayaan Mobility does its own
 * phone+password auth against the Prisma `User` table (see src/lib/auth.ts)
 * rather than Supabase Auth, so this client is created with the anon key
 * and only needs cookie plumbing because @supabase/ssr requires it --
 * it is not used to read/write a Supabase Auth session.
 *
 * Storage bucket access control (who can upload/read odometer photos etc.)
 * should be enforced via signed upload URLs issued from a Server Action
 * that has already checked the caller's role with requireRoleForAction(),
 * not via Supabase RLS keyed to a Supabase Auth session.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render, not a Server Action /
            // Route Handler -- cookies() is read-only there. Safe to ignore
            // as long as middleware.ts is refreshing sessions elsewhere.
          }
        },
      },
    }
  );
}
