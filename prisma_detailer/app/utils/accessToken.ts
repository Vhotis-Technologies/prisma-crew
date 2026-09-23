/**
 * Decode JWT expiry and refresh the crew access token for websocket + REST.
 */
import * as SecureStore from "expo-secure-store";
import { refreshTokenSuccess } from "@/app/store/slices/authSlice";
import type { AppDispatch } from "@/app/store/my_store";

export function isAccessTokenFresh(token: string | null | undefined, skewMs = 30_000): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + skewMs;
  } catch {
    return false;
  }
}

export async function ensureCrewAccessToken(options: {
  apiUrl: string | undefined;
  access: string | null | undefined;
  refresh: string | null | undefined;
  dispatch: AppDispatch;
}): Promise<string | null> {
  const { apiUrl, access, refresh, dispatch } = options;
  if (isAccessTokenFresh(access)) {
    return access ?? null;
  }
  if (!apiUrl || !refresh) {
    return access || null;
  }
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/v1/authentication/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) {
      return access || null;
    }
    const data = (await response.json()) as { access?: string; refresh?: string };
    if (!data.access) {
      return access || null;
    }
    const nextRefresh = data.refresh || refresh;
    dispatch(refreshTokenSuccess({ access: data.access, refresh: nextRefresh }));
    try {
      await SecureStore.setItemAsync("access", data.access);
      await SecureStore.setItemAsync("refresh", nextRefresh);
    } catch {
      /* SecureStore unavailable on some web previews */
    }
    return data.access;
  } catch {
    return access || null;
  }
}
