import type {
  AdminInvoice,
  AdminLinks,
  AdminUser,
  AppConfig,
  CreateUserPayload,
  Invoice,
  Paginated,
  StatusResponse,
  UserProfile,
  XuiClient,
} from "./types";

export const TOKEN_KEY = "fast-ray-token";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : response.statusText;

    if (response.status === 401) {
      clearAuthToken();
      unauthorizedHandler?.();
    }

    throw new ApiError(message, response.status);
  }

  return data as T;
}

export function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

export async function fetchMe(): Promise<UserProfile> {
  return request<UserProfile>("/user/me");
}

export async function createInvoice(amount: number): Promise<Invoice> {
  const returnUrl = window.location.href;

  return request<Invoice>("/tw/new-invoice", {
    method: "POST",
    body: JSON.stringify({
      amount,
      return_url: returnUrl,
      fail_url: returnUrl,
    }),
  });
}

export async function fetchStatus(): Promise<StatusResponse> {
  return request<StatusResponse>("/api/status");
}

export async function fetchAdminLinks(): Promise<AdminLinks> {
  return request<AdminLinks>("/admin/links");
}

export async function fetchInvoices(page = 1, limit = 3): Promise<Paginated<AdminInvoice>> {
  return request<Paginated<AdminInvoice>>(`/admin/invoices?page=${page}&limit=${limit}`);
}

export async function checkInvoices(): Promise<Invoice[]> {
  return request<Invoice[]>("/admin/invoices/check");
}

export async function cancelInvoice(id: number): Promise<Invoice> {
  return request<Invoice>(`/admin/invoices/${id}/cancel`, { method: "POST" });
}

export function buildAuthLink(token: string): string {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("authToken", token);
  return url.toString();
}

export async function fetchConfig(): Promise<AppConfig> {
  return request<AppConfig>("/api/config");
}

export async function createUser(payload: CreateUserPayload): Promise<string> {
  return request<string>("/admin/users/create", { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchUserById(id: number): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/get/${id}`);
}

export async function refreshUserToken(id: number): Promise<string> {
  return request<string>(`/admin/users/${id}/refresh-token`, { method: "POST" });
}

export async function deleteUser(id: number): Promise<void> {
  await request<null>(`/admin/users/delete/${id}`, { method: "DELETE" });
}

export async function fetchXuiClient(email: string): Promise<XuiClient> {
  return request<XuiClient>(`/xui/clients/get/${encodeURIComponent(email)}`);
}

export async function updateXuiClient(
  email: string,
  payload: { expiry_time_days: number; enable: boolean },
): Promise<string> {
  return request<string>(`/xui/clients/update/${encodeURIComponent(email)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetXuiClientTraffic(email: string): Promise<string> {
  return request<string>(`/xui/clients/reset-traffic/${encodeURIComponent(email)}`, { method: "POST" });
}

export async function deleteXuiClient(email: string): Promise<string> {
  return request<string>(`/xui/clients/delete/${encodeURIComponent(email)}`, { method: "DELETE" });
}
