import { emptyPagination } from "./pagination.js";
import { configDefaults, state, storageKey } from "./state.js";
import { updatePanel, ui } from "./ui.js";

let logoutHandler = () => {};

export function onLogout(handler) {
  logoutHandler = handler;
}

function mapAppConfig(data) {
  return {
    version: data.version || "",
    minInvoiceAmount: data.min_invoice_amount ?? configDefaults.minInvoiceAmount,
    maxInvoiceAmount: data.max_invoice_amount ?? configDefaults.maxInvoiceAmount,
    defaultExpiryTimeDays: data.default_expiry_time_days ?? configDefaults.defaultExpiryTimeDays,
  };
}

export async function loadAppConfig() {
  try {
    const response = state.token ? await api("/api/config") : await fetch("/api/config").then((res) => (res.ok ? res.json() : null));
    state.config = response ? mapAppConfig(response) : { ...configDefaults };
  } catch {
    state.config = { ...configDefaults };
  }

  return state.config;
}

function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatApiMessage(data, fallback) {
  if (!data) {
    return fallback || "Ошибка запроса";
  }

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || item).join(", ");
  }

  return data.detail || fallback || "Ошибка запроса";
}

function isInvalidToken(error) {
  return String(error?.message || "")
    .toLowerCase()
    .includes("invalid token");
}

export function isUnauthorized(error) {
  return error?.status === 401 || isInvalidToken(error);
}

export function buildAuthLink(token = state.token) {
  const url = new URL("/", window.location.origin);
  if (token) {
    url.searchParams.set("authToken", token);
  }
  return url.toString();
}

export function clearAuth() {
  localStorage.removeItem(storageKey);
  state.token = "";
  state.user = null;
  state.isAdmin = false;
  state.status = null;
  state.statusLoading = false;
  state.checkedInvoices = null;
  state.allInvoices = emptyPagination();
  state.adminLinks = null;
}

export function logoutToLogin(message = "Сессия истекла, войдите заново") {
  clearAuth();
  logoutHandler(message);
}

export function handleApiError(error, panelSelector) {
  if (isUnauthorized(error)) {
    logoutToLogin(error.message);
    return;
  }

  if (panelSelector) {
    updatePanel(panelSelector, ui.apiError(error.message));
  }
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? parseBody(text) : null;

  if (!response.ok) {
    const message = formatApiMessage(data, response.statusText);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}
