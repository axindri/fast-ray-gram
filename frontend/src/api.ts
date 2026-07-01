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

export const TOKEN_KEY = "authToken";

const API_PREFIX = "/api";

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
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("Неверный ответ сервера", response.status);
    }
  }

  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
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
  return request<UserProfile>(`${API_PREFIX}/user/me`);
}

export async function fetchXuiMe(): Promise<XuiClient> {
  return request<XuiClient>(`${API_PREFIX}/user/xui-me`);
}

export async function createInvoice(amount: number): Promise<Invoice> {
  const returnUrl = new URL("/payment/success", window.location.origin).href;
  const failUrl = new URL("/payment/fail", window.location.origin).href;

  return request<Invoice>(`${API_PREFIX}/tw/new-invoice`, {
    method: "POST",
    body: JSON.stringify({
      amount,
      return_url: returnUrl,
      fail_url: failUrl,
    }),
  });
}

export async function fetchStatus(): Promise<StatusResponse> {
  return request<StatusResponse>(`${API_PREFIX}/status`);
}

export async function fetchAdminLinks(): Promise<AdminLinks> {
  return request<AdminLinks>(`${API_PREFIX}/admin/links`);
}

export async function fetchInvoices(page = 1, limit = 3): Promise<Paginated<AdminInvoice>> {
  return request<Paginated<AdminInvoice>>(`${API_PREFIX}/admin/invoices?page=${page}&limit=${limit}`);
}

export async function fetchUsers(page = 1, limit = 20): Promise<Paginated<AdminUser>> {
  return request<Paginated<AdminUser>>(`${API_PREFIX}/admin/users?page=${page}&limit=${limit}`);
}

export async function checkInvoices(): Promise<Invoice[]> {
  return request<Invoice[]>(`${API_PREFIX}/admin/invoices/check`);
}

export async function cancelInvoice(id: number): Promise<Invoice> {
  return request<Invoice>(`${API_PREFIX}/admin/invoices/${id}/cancel`, { method: "POST" });
}

export function buildAuthLink(token: string): string {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("authToken", token);
  return url.toString();
}

export async function fetchConfig(): Promise<AppConfig> {
  return request<AppConfig>(`${API_PREFIX}/config`);
}

export async function createUser(payload: CreateUserPayload): Promise<string> {
  return request<string>(`${API_PREFIX}/admin/users/create`, { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchUserById(id: number): Promise<AdminUser> {
  return request<AdminUser>(`${API_PREFIX}/admin/users/get/${id}`);
}

export async function refreshUserToken(id: number): Promise<string> {
  return request<string>(`${API_PREFIX}/admin/users/${id}/refresh-token`, { method: "POST" });
}

export async function deleteUser(id: number): Promise<void> {
  await request<null>(`${API_PREFIX}/admin/users/delete/${id}`, { method: "DELETE" });
}

export async function fetchXuiClient(email: string): Promise<XuiClient> {
  return request<XuiClient>(`${API_PREFIX}/xui/clients/get/${encodeURIComponent(email)}`);
}

export async function updateXuiClient(
  email: string,
  payload: { expiry_time_days: number; enable: boolean },
): Promise<string> {
  return request<string>(`${API_PREFIX}/xui/clients/update/${encodeURIComponent(email)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetXuiClientTraffic(email: string): Promise<string> {
  return request<string>(`${API_PREFIX}/xui/clients/reset-traffic/${encodeURIComponent(email)}`, { method: "POST" });
}

export async function deleteXuiClient(email: string): Promise<string> {
  return request<string>(`${API_PREFIX}/xui/clients/delete/${encodeURIComponent(email)}`, { method: "DELETE" });
}
