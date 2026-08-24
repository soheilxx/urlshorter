"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState } from "@/actions/action-states";
import { login, logout } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().min(1, "Bitte E-Mail-Adresse angeben.").max(200),
  password: z.string().min(1, "Bitte Passwort angeben.").max(500),
});

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}
