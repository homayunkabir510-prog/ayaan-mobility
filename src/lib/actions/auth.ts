"use server";

import { z } from "zod";
import { login as loginUser, logout as logoutUser, type AuthUser } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/actions/shared";

const loginSchema = z.object({
  phone: z.string().min(6, "Enter a valid phone number."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export async function loginAction(rawInput: LoginInput): Promise<ActionResult<AuthUser>> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  const user = await loginUser(parsed.data.phone, parsed.data.password);
  if (!user) return fail("Phone number or password is incorrect.");

  return ok(user);
}

export async function logoutAction(): Promise<ActionResult<null>> {
  await logoutUser();
  return ok(null);
}
