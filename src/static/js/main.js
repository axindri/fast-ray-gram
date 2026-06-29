import { api, buildAuthLink, clearAuth, handleApiError, isUnauthorized, logoutToLogin, onLogout } from "./api.js";
import { app, state, storageKey } from "./state.js";
import {
  formatDate,
  formData,
  prepareFormAction,
  resetDeleteConfirm,
  toNumber,
  ui,
  updatePanel,
  withBusy,
} from "./ui.js";
import { emptyPagination } from "./pagination.js";
import { checkInvoices, createPayment, loadAllInvoices, loadStatus, refreshProfile, renderDashboard, renderLogin, stopStatusPolling } from "./views.js";

onLogout(renderLogin);

const formHandlers = {
  login: submitLogin,
  "create-user": submitCreateUser,
  "user-actions": submitUserActions,
  "xui-client": submitXuiClient,
  "new-payment": (form) => createPayment(form),
};

const formFeedback = {
  "create-user": "#create-user-feedback",
  "user-actions": "#user-manage-feedback",
  "xui-client": "#xui-feedback",
  "new-payment": "#profile-invoices-feedback",
};

const actionHandlers = {
  logout: () => logoutToLogin(),
  "check-invoices": checkInvoices,
  "load-status": loadStatus,
  "refresh-profile": refreshProfile,
  "invoices-prev": () => loadAllInvoices({ page: state.allInvoices.page - 1 }),
  "invoices-next": () => loadAllInvoices({ page: state.allInvoices.page + 1 }),
};

const actionFeedback = {
  "check-invoices": "#invoices-feedback",
  "load-status": "#status-feedback",
  "refresh-profile": "#profile-invoices-feedback",
  "invoices-prev": "#all-invoices-feedback",
  "invoices-next": "#all-invoices-feedback",
};

function renderUserAuthLink(token) {
  return ui.authLinkResult(buildAuthLink(token));
}

function flashButtonLabel(button, label, duration = 1800) {
  const originalText = button.textContent;
  button.textContent = label;
  setTimeout(() => {
    button.textContent = originalText;
  }, duration);
}

async function login(token) {
  state.token = token;
  state.status = null;
  state.statusLoading = false;
  state.checkedInvoices = null;
  state.allInvoices = emptyPagination();
  localStorage.setItem(storageKey, token);

  state.user = await api("/user/me");
  state.isAdmin = ["admin", "superuser"].includes(state.user.role);

  await renderDashboard();
}

async function submitLogin(form) {
  const data = formData(form);
  await withBusy(form, () => login(data.token.trim()));
}

async function submitCreateUser(form) {
  await withBusy(form.closest(".card"), async () => {
    updatePanel("#create-user-feedback", "");
    const data = formData(form);
    const token = await api("/admin/users/create", {
      method: "POST",
      body: JSON.stringify({
        username: data.username,
        role: data.role,
        mark: data.mark,
        flow: data.flow,
        limit_ips: toNumber(data.limit_ips),
        total_gb: toNumber(data.total_gb),
        expiry_time_days: toNumber(data.expiry_time_days) || state.config?.defaultExpiryTimeDays || 30,
        enable: true,
      }),
    });
    updatePanel("#create-user-feedback", ui.readonly("Новый токен", token));
  });
}

async function submitUserActions(form, submitter) {
  const action = prepareFormAction(form, submitter);
  if (!action) {
    return;
  }

  await withBusy(form.closest(".card"), async () => {
    updatePanel("#user-manage-feedback", "");
    const { id } = formData(form);
    const routes = {
      get: [`/admin/users/get/${id}`, "GET"],
      refresh: [`/admin/users/${id}/refresh-token`, "POST"],
      delete: [`/admin/users/delete/${id}`, "DELETE"],
    };
    const [path, method] = routes[action];
    const result = await api(path, { method });
    resetDeleteConfirm(form);

    if (action === "refresh") {
      updatePanel("#user-manage-auth-link", renderUserAuthLink(result));
      return;
    }

    if (action === "delete") {
      updatePanel("#user-manage-auth-link", "");
      updatePanel("#user-manage-feedback", ui.status("Пользователь удалён"));
      return;
    }

    updatePanel("#user-manage-auth-link", "");
    updatePanel(
      "#user-manage-feedback",
      `<div class="item"><b>${result.username}</b><span>ID: ${result.id} · ${result.role}</span></div>`,
    );
  });
}

async function submitXuiClient(form, submitter) {
  const action = prepareFormAction(form, submitter);
  if (!action) {
    return;
  }

  await withBusy(form.closest(".card"), async () => {
    updatePanel("#xui-feedback", "");
    const data = formData(form);
    const email = encodeURIComponent(data.email);

    if (action === "update") {
      await api(`/xui/clients/update/${email}`, {
        method: "POST",
        body: JSON.stringify({
          expiry_time_days: toNumber(data.expiry_time_days),
          enable: data.enable === "true",
        }),
      });
      updatePanel("#xui-feedback", ui.status("Клиент обновлён"));
      return;
    }

    const routes = {
      get: [`/xui/clients/get/${email}`, "GET"],
      reset: [`/xui/clients/reset-traffic/${email}`, "POST"],
      delete: [`/xui/clients/delete/${email}`, "DELETE"],
    };
    const [path, method] = routes[action];
    const result = await api(path, { method });
    resetDeleteConfirm(form);

    if (action === "get") {
      updatePanel(
        "#xui-feedback",
        `<div class="item"><b>${result.email}</b><span>до ${formatDate(result.expiry_datetime)} · ${result.total_gb} GB</span></div>`,
      );
      return;
    }

    updatePanel("#xui-feedback", ui.status(action === "delete" ? "Клиент удалён" : "Трафик сброшен"));
  });
}

async function handleForm(event) {
  event.preventDefault();
  const form = event.target;
  const handler = formHandlers[form.dataset.form];

  try {
    await handler(form, event.submitter);
  } catch (error) {
    if (form.dataset.form === "login") {
      if (isUnauthorized(error)) {
        logoutToLogin(error.message);
        return;
      }
      await renderLogin(error.message);
      return;
    }

    handleApiError(error, formFeedback[form.dataset.form]);
  }
}

async function handleAction(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if ("copy" in button.dataset) {
    const copyText = button.closest(".copy-field")?.querySelector("input")?.value || "";
    await navigator.clipboard.writeText(copyText);
    flashButtonLabel(button, "Скопировано!");
    return;
  }

  if ("copyAuthLink" in button.dataset) {
    const link = button.closest(".auth-link-result")?.querySelector("[data-auth-link]")?.value || "";
    if (!link) {
      return;
    }
    await navigator.clipboard.writeText(link);
    flashButtonLabel(button, "Скопировано!");
    return;
  }

  const action = button.dataset.action;
  const handler = action && actionHandlers[action];
  if (!handler) {
    return;
  }

  if (action === "invoices-prev" && state.allInvoices.page <= 1) {
    return;
  }

  if (action === "invoices-next" && state.allInvoices.page >= state.allInvoices.pages) {
    return;
  }

  try {
    await handler();
  } catch (error) {
    handleApiError(error, actionFeedback[action]);
  }
}

app.addEventListener("submit", handleForm);
app.addEventListener("click", handleAction);

function parseAuthTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("authToken")?.trim() || "";
}

function stripAuthTokenFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("authToken")) {
    return;
  }

  url.searchParams.delete("authToken");
  const query = url.searchParams.toString();
  window.history.replaceState({}, "", `${url.pathname}${query ? `?${query}` : ""}${url.hash}`);
}

async function loginWithErrorHandling(token) {
  try {
    await login(token);
  } catch (error) {
    if (isUnauthorized(error)) {
      clearAuth();
    }
    await renderLogin(error.message);
  }
}

async function boot() {
  const urlToken = parseAuthTokenFromUrl();

  if (urlToken) {
    stopStatusPolling();
    clearAuth();
    stripAuthTokenFromUrl();
    await loginWithErrorHandling(urlToken);
    return;
  }

  if (state.token) {
    await loginWithErrorHandling(state.token);
    return;
  }

  await renderLogin();
}

boot();
