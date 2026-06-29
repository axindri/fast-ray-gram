import { state, storageKey } from "./state.js";
import { showFeedback, ui } from "./ui.js";

let logoutHandler = () => {};

export function onLogout(handler) {
  logoutHandler = handler;
}

export async function loadAppConfig() {
  const defaults = {
    version: "",
    minInvoiceAmount: 100,
    maxInvoiceAmount: 1000,
    defaultExpiryTimeDays: 30,
  };

  try {
    const response = await fetch("/api/config");
    if (!response.ok) {
      state.config = defaults;
      return state.config;
    }

    const data = await response.json();
    state.config = {
      version: data.version || "",
      minInvoiceAmount: data.min_invoice_amount ?? defaults.minInvoiceAmount,
      maxInvoiceAmount: data.max_invoice_amount ?? defaults.maxInvoiceAmount,
      defaultExpiryTimeDays: data.default_expiry_time_days ?? defaults.defaultExpiryTimeDays,
    };
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

export function logoutToLogin(message = "Сессия истекла, войдите заново") {
  localStorage.removeItem(storageKey);
  state.token = "";
  state.user = null;
  state.isAdmin = false;
  state.status = null;
  state.statusLoading = false;
  state.checkedInvoices = null;
  state.allInvoices = null;
  logoutHandler(message);
}

export function handleApiError(error, footerSelector) {
  if (isInvalidToken(error)) {
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
    throw new Error(message);
  }

  return data;
}
