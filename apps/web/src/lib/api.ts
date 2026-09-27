import { useState, useEffect, useCallback } from "react";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pr_token");
}

export function setToken(token: string) {
  localStorage.setItem("pr_token", token);
}

export function clearToken() {
  localStorage.removeItem("pr_token");
  localStorage.removeItem("pr_user");
}

export function getStoredUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("pr_user");
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: any) {
  localStorage.setItem("pr_user", JSON.stringify(user));
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function friendlyDetail(detail: unknown, status: number): string {
  if (status === 0) return "The server could not be reached. Please check your connection and try again.";
  if (status === 401) return "Email or password is incorrect. Please check and try again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested information was not found.";
  if (status === 409) return "This email is already registered. Please use another email or sign in.";
  if (status >= 500) return "The server is temporarily unavailable. Please try again shortly.";

  if (Array.isArray(detail)) {
    const first = detail[0] as { loc?: unknown[]; msg?: string } | undefined;
    const field = first?.loc?.[first.loc.length - 1];
    if (field === "email") return "Please enter a valid email address, such as name@example.com.";
    if (field === "password") return "Please enter a password with at least 6 characters.";
    if (field === "name") return "Please enter your full name.";
    if (field === "phone") return "Please enter a valid phone number.";
    if (field === "district") return "Please enter your district.";
    return "Please check the highlighted information and try again.";
  }

  if (typeof detail === "string") {
    if (detail.toLowerCase().includes("incorrect email or password")) {
      return "Email or password is incorrect. Please check and try again.";
    }
    if (status === 422) return "Please check the entered information and try again.";
    return detail;
  }
  return "Something went wrong. Please check your information and try again.";
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof URLSearchParams)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "The server could not be reached. Please check your connection and try again.");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {}
    throw new ApiError(res.status, friendlyDetail(detail, res.status));
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) =>
    request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    return request("/api/v1/auth/login", { method: "POST", body: form });
  },
  register: (name: string, email: string, password: string, phone: string, district: string) =>
    request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, phone, district }),
    }),
  googleLogin: (credential: string) =>
    request("/api/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
};

export { ApiError };

export type ApiListState = "loading" | "ready" | "error" | "offline";

/**
 * Shared data-fetch hook that fixes the "silent .catch(() => {})" pattern
 * that used to hide every failure behind an empty-looking list. Distinguishes
 * loading / a genuine empty result / a real server error / being offline,
 * so a page can never show "No alerts" when what actually happened is that
 * the request failed or the network is down (see docs/error-handling.md).
 */
export function useApiList<T = any>(path: string | null, deps: React.DependencyList = []) {
  const [data, setData] = useState<T[]>([]);
  const [state, setState] = useState<ApiListState>("loading");
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    if (!path) return;
    setState("loading");
    api.get(path)
      .then((res) => { setData(res || []); setState("ready"); })
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
          setState("error");
        } else {
          setState("offline");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => { reload(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, setData, state, error, reload };
}
