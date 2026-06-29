import { api, handleApiError, isInvalidToken, logoutToLogin, onLogout } from "./api.js";
import { app, state, storageKey } from "./state.js";
import { formatDate, formData, needsDeleteConfirm, resetDeleteConfirm, showFeedback, toNumber, ui, withBusy } from "./ui.js";
import { emptyPagination } from "./pagination.js";
import { checkInvoices, createPayment, loadAllInvoices, loadStatus, refreshProfile, renderDashboard, renderLogin } from "./views.js";

onLogout(renderLogin);

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
    showFeedback("#create-user-feedback", "");
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
        expiry_time_days: toNumber(data.expiry_time_days),
        enable: true,
      }),
    });
    showFeedback("#create-user-feedback", ui.readonly("Новый токен", token));
  });
}

async function submitUserActions(form, submitter) {
  const action = submitter.value;

  if (action !== "delete") {
    resetDeleteConfirm(form);
  }

  if (needsDeleteConfirm(action, submitter)) {
    return;
  }

  await withBusy(form.closest(".card"), async () => {
    showFeedback("#user-manage-feedback", "");
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
      showFeedback("#user-manage-feedback", ui.readonly("Новый токен", result));
      return;
    }

    if (action === "delete") {
      showFeedback("#user-manage-feedback", ui.status("Пользователь удалён"));
      return;
    }

    showFeedback("#user-manage-feedback", `<div class="item"><b>${result.username}</b><span>ID: ${result.id} · ${result.role}</span></div>`);
  });
}

async function submitXuiClient(form, submitter) {
  const action = submitter.value;

  if (action !== "delete") {
    resetDeleteConfirm(form);
  }

  if (needsDeleteConfirm(action, submitter)) {
    return;
  }

  await withBusy(form.closest(".card"), async () => {
    showFeedback("#xui-feedback", "");
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
      showFeedback("#xui-feedback", ui.status("Клиент обновлён"));
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
      showFeedback("#xui-feedback", `<div class="item"><b>${result.email}</b><span>до ${formatDate(result.expiry_datetime)} · ${result.total_gb} GB</span></div>`);
      return;
    }

    showFeedback("#xui-feedback", ui.status(action === "delete" ? "Клиент удалён" : "Трафик сброшен"));
  });
}

async function handleForm(event) {
  event.preventDefault();
  const form = event.target;
  const submitter = event.submitter;

  try {
    const handlers = {
      login: submitLogin,
      "create-user": submitCreateUser,
      "user-actions": submitUserActions,
      "xui-client": submitXuiClient,
      "new-payment": (form) => createPayment(form),
    };
    await handlers[form.dataset.form](form, submitter);
  } catch (error) {
    if (form.dataset.form === "login") {
      if (isInvalidToken(error)) {
        logoutToLogin(error.message);
        return;
      }
      await renderLogin(error.message);
      return;
    }

    const feedback = {
      "create-user": "#create-user-feedback",
      "user-actions": "#user-manage-feedback",
      "xui-client": "#xui-feedback",
      "new-payment": "#profile-invoices-feedback",
    }[form.dataset.form];

    handleApiError(error, feedback);
  }
}

async function handleAction(event) {
  if ("copy" in event.target.dataset) {
    const button = event.target;
    const copyText = button.closest(".copy-field")?.querySelector("input")?.value || "";
    await navigator.clipboard.writeText(copyText);
    const originalText = button.textContent;
    button.textContent = "Скопировано!";
    setTimeout(() => {
      button.textContent = originalText;
    }, 1800);
    return;
  }

  const action = event.target.dataset.action;
  if (!action) {
    return;
  }

  if (action === "logout") {
    logoutToLogin();
    return;
  }

  try {
    if (action === "check-invoices") {
      await checkInvoices();
    }
    if (action === "load-status") {
      await loadStatus();
    }
    if (action === "refresh-profile") {
      await refreshProfile();
    }
    if (action === "invoices-prev") {
      if (state.allInvoices.page <= 1) {
        return;
      }
      await loadAllInvoices({ page: state.allInvoices.page - 1 });
    }
    if (action === "invoices-next") {
      if (state.allInvoices.page >= state.allInvoices.pages) {
        return;
      }
      await loadAllInvoices({ page: state.allInvoices.page + 1 });
    }
  } catch (error) {
    const feedback = {
      "check-invoices": "#invoices-feedback",
      "load-status": "#status-feedback",
      "refresh-profile": "#profile-invoices-feedback",
      "invoices-prev": "#all-invoices-feedback",
      "invoices-next": "#all-invoices-feedback",
    }[action];
    handleApiError(error, feedback);
  }
}

app.addEventListener("submit", handleForm);
app.addEventListener("click", handleAction);

async function boot() {
  if (state.token) {
    try {
      await login(state.token);
    } catch (error) {
      if (isInvalidToken(error)) {
        logoutToLogin(error.message);
        return;
      }
      await renderLogin(error.message);
    }
    return;
  }

  await renderLogin();
}

boot();
