"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { EMPTY_USER_STATE } from "@/actions/action-states";
import {
  changeOwnPasswordAction,
  createUserAction,
  resetUserPasswordAction,
  updateUserAction,
} from "@/actions/user-actions";
import { useSuccessRefresh } from "@/components/admin/use-success-refresh";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ALL_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";

/** Erzeugt clientseitig ein zufälliges, gut lesbares Passwort (16 Zeichen). */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%+-";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function PasswordFieldWithGenerator({
  id,
  name,
  label,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name={name}
          type="text"
          required
          minLength={12}
          maxLength={500}
          autoComplete={autoComplete}
          placeholder="mind. 12 Zeichen"
          className="font-mono"
        />
        <Button
          type="button"
          variant="secondary"
          title="Zufallspasswort erzeugen"
          onClick={() => {
            const input = document.getElementById(id);
            if (input instanceof HTMLInputElement) input.value = generatePassword();
          }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Zufallspasswort erzeugen</span>
        </Button>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        Wird nur einmal angezeigt – sicher an die Person übermitteln.
      </p>
    </div>
  );
}

function RoleSelect({ id, defaultValue }: { id: string; defaultValue?: Role }) {
  return (
    <div>
      <Label htmlFor={id}>Rolle</Label>
      <Select id={id} name="role" defaultValue={defaultValue ?? "VIEWER"} required>
        {ALL_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]} – {ROLE_DESCRIPTIONS[role]}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function UserCreateForm() {
  const [state, formAction, pending] = useActionState(createUserAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, true);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div>
        <Label htmlFor="user-email">E-Mail-Adresse</Label>
        <Input
          id="user-email"
          name="email"
          type="email"
          required
          maxLength={200}
          placeholder="name@firma.de"
          autoComplete="off"
        />
      </div>
      <div>
        <Label htmlFor="user-name">Name (optional)</Label>
        <Input id="user-name" name="name" maxLength={200} placeholder="Vor- und Nachname" />
      </div>
      <RoleSelect id="user-role" />
      <PasswordFieldWithGenerator
        id="user-password"
        name="password"
        label="Initiales Passwort"
        autoComplete="new-password"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Wird angelegt …" : "Benutzer anlegen"}
      </Button>
    </form>
  );
}

export function UserEditForm({
  user,
  isSelf,
}: {
  user: { id: string; email: string; name: string | null; role: Role; active: boolean };
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateUserAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, false);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <input type="hidden" name="id" value={user.id} />

      <div>
        <Label htmlFor="edit-user-email">E-Mail-Adresse</Label>
        <Input id="edit-user-email" value={user.email} disabled />
      </div>
      <div>
        <Label htmlFor="edit-user-name">Name (optional)</Label>
        <Input id="edit-user-name" name="name" maxLength={200} defaultValue={user.name ?? ""} />
      </div>
      {isSelf ? (
        <>
          <input type="hidden" name="role" value={user.role} />
          <input type="hidden" name="active" value={user.active ? "true" : "false"} />
          <p className="text-xs text-zinc-400">
            Die eigene Rolle und der eigene Status können nicht geändert werden.
          </p>
        </>
      ) : (
        <>
          <RoleSelect id="edit-user-role" defaultValue={user.role} />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="active"
              value="true"
              defaultChecked={user.active}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Konto aktiv (deaktivierte Benutzer können sich nicht anmelden)
          </label>
        </>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Wird gespeichert …" : "Änderungen speichern"}
      </Button>
    </form>
  );
}

export function UserResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, true);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <input type="hidden" name="id" value={userId} />
      <PasswordFieldWithGenerator
        id="reset-password"
        name="password"
        label="Neues Passwort"
        autoComplete="new-password"
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Wird gesetzt …" : "Passwort neu setzen"}
      </Button>
    </form>
  );
}

export function ChangeOwnPasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, true);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div>
        <Label htmlFor="current-password">Aktuelles Passwort</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          required
          maxLength={500}
          autoComplete="current-password"
        />
      </div>
      <div>
        <Label htmlFor="new-password">Neues Passwort</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={500}
          autoComplete="new-password"
          placeholder="mind. 12 Zeichen"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird geändert …" : "Passwort ändern"}
      </Button>
    </form>
  );
}
