import { validateAdminSession } from "@/lib/assessment-api";

const ADMIN_TOKEN_STORAGE_KEY = "gahasp_admin_token";
const ADMIN_EXPIRES_AT_STORAGE_KEY = "gahasp_admin_expires_at";

export function getStoredAdminToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
}

export function getStoredAdminExpiresAt() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_EXPIRES_AT_STORAGE_KEY) ?? "";
}

export function storeAdminSession(token: string, expiresAt: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(ADMIN_EXPIRES_AT_STORAGE_KEY, expiresAt);
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(ADMIN_EXPIRES_AT_STORAGE_KEY);
}

export async function ensureAdminSession() {
  const token = getStoredAdminToken();
  if (!token) return false;

  try {
    await validateAdminSession(token);
    return true;
  } catch {
    clearAdminSession();
    return false;
  }
}
