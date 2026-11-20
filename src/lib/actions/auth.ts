"use server";

import { z } from "zod";
import { login as loginUser, logout as logoutUser, type AuthUser } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/actions/shared";
import { isBcryptPasswordLengthValid } from "@/lib/password-policy";

const loginSchema = z.object({
  phone: z.string().trim().min(6, "Enter a valid phone number.").max(32),
  password: z.string().min(1, "Enter your password.").max(128)
    .refine(isBcryptPasswordLengthValid, "Password must not exceed 72 UTF-8 bytes."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export async function loginAction(rawInput: LoginInput): Promise<ActionResult<AuthUser>> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  try {
    const user = await loginUser(parsed.data.phone, parsed.data.password);
    if (!user) return fail("Phone number or password is incorrect.");
    return ok(user);
  } catch (error) {
    console.error("loginAction failed", error instanceof Error ? error.name : "UnknownError");
    return fail("Sign-in is temporarily unavailable. Please try again.");
  }
}

export async function logoutAction(): Promise<ActionResult<null>> {
  try {
    await logoutUser();
    return ok(null);
  } catch (error) {
    console.error("logoutAction failed", error instanceof Error ? error.name : "UnknownError");
    return fail("Could not sign out. Please try again.");
  }
}
