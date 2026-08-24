"use client";

import { useActionState } from "react";
import { EMPTY_AUTH_STATE } from "@/actions/action-states";
import { loginAction } from "@/actions/auth-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const initialState = EMPTY_AUTH_STATE;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      <div>
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="admin@example.com"
        />
      </div>
      <div>
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Anmeldung läuft …" : "Anmelden"}
      </Button>
    </form>
  );
}
