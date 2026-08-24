/**
 * Gemeinsame State-Typen und Initialwerte für Server Actions.
 * Bewusst OHNE "use server" – solche Dateien dürfen nur async-Funktionen
 * exportieren, daher liegen die Konstanten hier.
 */

export interface AuthActionState {
  error: string | null;
}

export const EMPTY_AUTH_STATE: AuthActionState = { error: null };

export interface DestinationActionState {
  ok: boolean;
  error: string | null;
  success: string | null;
  /** Gesetzt, wenn eine URL-Änderung einer verwendeten Destination bestätigt werden muss. */
  needsConfirm: boolean;
  linkCount: number;
}

export const EMPTY_DESTINATION_STATE: DestinationActionState = {
  ok: false,
  error: null,
  success: null,
  needsConfirm: false,
  linkCount: 0,
};

export interface LinkActionState {
  ok: boolean;
  error: string | null;
  success: string | null;
  createdCodes: string[];
}

export const EMPTY_LINK_STATE: LinkActionState = {
  ok: false,
  error: null,
  success: null,
  createdCodes: [],
};

export interface SettingsActionState {
  ok: boolean;
  error: string | null;
  success: string | null;
}

export const EMPTY_SETTINGS_STATE: SettingsActionState = {
  ok: false,
  error: null,
  success: null,
};
