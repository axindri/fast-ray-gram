import { emptyPagination } from "./pagination.js";
import { state, storageKey } from "./state.js";
import { showFeedback, ui } from "./ui.js";

let logoutHandler = () => {};

export function onLogout(handler) {
  logoutHandler = handler;
}

function mapAppConfig(data, defaults) {
  return {
    version: data.version || "",
    minInvoiceAmount: data.min_invoice_amount ?? defaults.minInvoiceAmount,
    maxInvoiceAmount: data.max_invoice_amount ?? defaults.maxInvoiceAmount,
    defaultExpiryTimeDays: data.default_expiry_time_days ?? defaults.defaultExpiryTimeDays,
  };
}

export async function loadAppConfig() {
  const defaults = {
    version: "",
    minInvoiceAmount: 100,
    maxInvoiceAmount: 1000,
    defaultExpiryTimeDays: 30,
  };

  try {
    const data = state.token ? await api("/api/config") : await fetch("/api/config").then(async (response) => (response.ok ? response.json() : null));

    if (!data) {
      state.config = defaults;
      return state.config;
    }

    state.config = mapAppConfig(data, defaults);
  } catch {
    state.config = defaults;
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

export function isInvalidToken(error) {
  return String(error?.message || "")
    .toLowerCase()
    .includes("invalid token");
}

export function isUnauthorized(error) {
  return error?.status === 401 || isInvalidToken(error);
}

export function logoutToLogin(message = "Сессия истекла, войдите заново") {
  localStorage.removeItem(storageKey);
  state.token = "";
  state.user = null;
  state.isAdmin = false;
  state.status = null;
  state.statusLoading = false;
  state.checkedInvoices = null;
  state.allInvoices = emptyPagination();
  logoutHandler(message);
}

export function handleApiError(error, footerSelector) {
  if (isUnauthorized(error)) {
    logoutToLogin(error.message);
    return;
  }

  if (footerSelector) {
    showFeedback(footerSelector, ui.apiError(error.message));
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
