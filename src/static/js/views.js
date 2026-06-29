import { api, handleApiError, loadAppConfig } from "./api.js";
import { pickQuote, renderQuote } from "./quotes.js";
import { state } from "./state.js";
import { formatDate, formData, isPaymentBlocked, renderPayControl, renderStatusBanner, shell, showFeedback, toNumber, ui, updatePanel, updatePaymentFormState, withBusy } from "./ui.js";

function displayName(username = "") {
  if (!username) {
    return "друг";
  }

  return username.charAt(0).toUpperCase() + username.slice(1);
}

function roleLabel(role) {
  if (role === "admin") {
    return "Администратор";
  }
  if (role === "superuser") {
    return "Суперпользователь";
  }
  return "";
}

function welcomeContent(quote = pickQuote()) {
  const subUrl = state.user?.sub_url || "";
  const role = state.user?.role || "";
  const showRole = role === "admin" || role === "superuser";

  return `
    <div class="stack welcome-body">
      <div class="welcome-head">
        <h2 class="welcome-title">Привет, ${displayName(state.user?.username)}!</h2>
        ${showRole ? `<p class="welcome-role">${roleLabel(role)}</p>` : ""}
      </div>
      ${renderQuote(quote)}
      ${subUrl ? ui.readonly("Ссылка подписки", subUrl) : ""}
    </div>
  `;
}

export async function renderLogin(message = "") {
  await loadAppConfig();

  shell(`
    <div class="grid">
      ${ui.card(
        "Вход",
        `<form class="form" data-form="login">
          ${ui.field("token", "Bearer token", "password", state.token, "autocomplete='current-password'")}
          <button class="btn primary" type="submit">Войти</button>
          ${message ? ui.apiError(message) : ""}
        </form>`,
        "Вставьте ваш авторизационный токен",
      )}
      ${ui.card("На сегодня", renderQuote(pickQuote()))}
    </div>
  `);
}

export async function renderDashboard() {
  await loadAppConfig();

  state.statusLoading = true;

  const blocks = [welcomeBlock()];

  if (state.user?.role !== "superuser") {
    blocks.push(profileInvoicesBlock());
  }

  if (state.isAdmin) {
    blocks.push(statusBlock(), invoicesBlock(), allInvoicesBlock(), adminCreateUserBlock(), adminUserManageBlock(), xuiBlock());
  }

  shell(`<div class="grid">${blocks.join("")}</div>`);
  updatePaymentFormState();

  requestAnimationFrame(() => {
    setTimeout(() => {
      loadStatus({ quiet: true });
      if (state.isAdmin) {
        loadAllInvoices({ quiet: true });
      }
    }, 0);
  });
}

function welcomeBlock() {
  return `
    <section class="card welcome-card">
      <div id="welcome-info">${welcomeContent()}</div>
    </section>
  `;
}

function renderProfileInvoicesList() {
  const invoices = state.user?.invoices || [];

  if (!invoices.length) {
    return `<p class="muted">Счетов пока нет</p>`;
  }

  return invoices.map(invoiceItem).join("");
}

function profileInvoicesBlock() {
  const minInvoiceAmount = state.config?.minInvoiceAmount ?? 100;
  const maxInvoiceAmount = state.config?.maxInvoiceAmount ?? 1000;

  return ui.card(
    "Мои инвойсы",
    `<div class="stack">
      <p id="payment-status-hint" class="payment-hint is-loading">Загружаем статус сервисов...</p>
      <form class="form row wrap" data-form="new-payment">
        ${ui.field("amount", "Сумма, ₽", "number", String(minInvoiceAmount), `min='${minInvoiceAmount}' max='${maxInvoiceAmount}' required disabled`)}
        <button class="btn primary" type="submit" disabled>Создать платёж</button>
      </form>
      <div class="row between wrap">
        <p class="muted no-margin">История платежей и статусы</p>
        ${ui.button("Обновить", "refresh-profile", "ghost")}
      </div>
      <p class="payment-hint is-loading" data-invoice-pay-hint>Оплатить счета нельзя — загружаем статус сервисов.</p>
      <div id="profile-invoices" class="list">${renderProfileInvoicesList()}</div>
    </div>`,
    "",
    "profile-invoices-feedback",
  );
}

const invoiceStatusLabels = {
  pending: "Ожидает оплаты",
  paid: "Оплачено",
  cancelled: "Отменён",
};

function invoiceStatusPill(status) {
  const value = String(status || "").toLowerCase();
  const label = invoiceStatusLabels[value] || value || "—";
  const klass = invoiceStatusLabels[value] ? value : "";
  return `<span class="pill${klass ? ` ${klass}` : ""}">${label}</span>`;
}

function invoicePaySlot(item) {
  const status = String(item.status || "").toLowerCase();
  if (status === "cancelled" || !item.confirmation_url) {
    return "";
  }

  return `<div class="invoice-pay-slot" data-confirmation-url="${item.confirmation_url}">${renderPayControl(item.confirmation_url)}</div>`;
}

function invoiceItem(item, { admin = false } = {}) {
  return `
    <div class="item invoice">
      <div class="row between">
        <b>#${item.invoice_id}</b>
        ${invoiceStatusPill(item.status)}
      </div>
      ${admin ? `<span>User ID: ${item.user_id}</span>` : ""}
      <span>Создан: ${formatDate(item.created_at)}</span>
      ${invoicePaySlot(item)}
    </div>
  `;
}

function adminCreateUserBlock() {
  const expiryDays = state.config?.defaultExpiryTimeDays ?? 30;

  return ui.card(
    "Создать пользователя",
    `<form class="form" data-form="create-user">
      ${ui.field("username", "Username")}
      ${ui.select("role", "Роль", ["user", "admin"])}
      ${ui.field("mark", "Заметка")}
      ${ui.field("flow", "Flow")}
      <div class="row">
        ${ui.field("limit_ips", "Лимит IP", "number", "0")}
        ${ui.field("total_gb", "Объем трафика", "number", "0")}
        ${ui.field("expiry_time_days", "Срок действия", "number", String(expiryDays))}
      </div>
      <button class="btn primary" type="submit">Создать</button>
    </form>`,
    "Создание нового пользователя и XUI-клиента",
    "create-user-feedback",
  );
}

function adminUserManageBlock() {
  return ui.card(
    "Пользователь по ID",
    `<form class="form" data-form="user-actions">
      ${ui.field("id", "User ID", "number")}
      <div class="row">
        <button class="btn ghost" name="action" value="get" type="submit">Получить</button>
        <button class="btn ghost" name="action" value="refresh" type="submit">Обновить токен</button>
        <button class="btn danger" name="action" value="delete" type="submit">Удалить</button>
      </div>
    </form>`,
    "Получение, refresh token и удаление",
    "user-manage-feedback",
  );
}

function xuiBlock() {
  const expiryDays = state.config?.defaultExpiryTimeDays ?? 30;

  return ui.card(
    "XUI клиент",
    `<form class="form" data-form="xui-client">
      ${ui.field("email", "Email")}
      <div class="row">
        <button class="btn ghost" name="action" value="get" type="submit">Получить</button>
        <button class="btn ghost" name="action" value="reset" type="submit">Сбросить трафик</button>
        <button class="btn danger" name="action" value="delete" type="submit">Удалить</button>
      </div>
      <div class="row">
        ${ui.field("expiry_time_days", "Продлить на дней", "number", String(expiryDays))}
        ${ui.select("enable", "Enable", ["true", "false"])}
        <button class="btn primary" name="action" value="update" type="submit">Обновить</button>
      </div>
    </form>`,
    "",
    "xui-feedback",
  );
}

function invoicesBlock() {
  return ui.card(
    "Платежи",
    `<div class="stack">
      <p class="muted">Проверить оплаченные счета и активировать клиентов.</p>
      ${ui.button("Проверить инвойсы", "check-invoices")}
      <div id="invoices-content" class="list">${renderCheckedInvoices()}</div>
    </div>`,
    "",
    "invoices-feedback",
  );
}

function allInvoicesBlock() {
  return ui.card(
    "Все инвойсы",
    `<div class="stack">
      <p class="muted">Последние 100 счетов в любом статусе.</p>
      <p class="payment-hint hide" data-invoice-pay-hint></p>
      <div id="all-invoices-content" class="list"><p class="muted">Загружаю...</p></div>
    </div>`,
    "",
    "all-invoices-feedback",
  );
}

function renderAllInvoicesList() {
  if (!state.allInvoices) {
    return `<p class="muted">Загружаю...</p>`;
  }

  if (!state.allInvoices.length) {
    return `<p class="muted">Инвойсов нет</p>`;
  }

  return state.allInvoices.map((item) => invoiceItem(item, { admin: true })).join("");
}

function statusBlock() {
  return ui.card(
    "Статус",
    `<div class="stack">
      <p class="muted">Проверка API, XUI и TimeWeb.</p>
      ${ui.button("Обновить статус", "load-status", "ghost")}
      <div id="status-content" class="list">${renderStatus()}</div>
    </div>`,
    "",
    "status-feedback",
  );
}

function renderCheckedInvoices() {
  if (!state.checkedInvoices) {
    return `<p class="muted">Проверка ещё не запускалась</p>`;
  }

  if (!state.checkedInvoices.length) {
    return ui.status("Новых оплаченных инвойсов нет");
  }

  return state.checkedInvoices.map(invoiceItem).join("");
}

export function renderStatus() {
  if (!state.status) {
    return `<p class="muted">Загружаю статус...</p>`;
  }

  return [ui.service("API", state.status.API), ui.service("XUI", state.status.XUI), ui.service("TimeWeb", state.status.TimeWeb)].join("");
}

export async function loadStatus({ quiet = false } = {}) {
  const card = document.querySelector("#status-content")?.closest(".card");

  const fetchStatus = async () => {
    state.statusLoading = true;
    renderStatusBanner();
    updatePaymentFormState();
    updatePanel("#status-feedback", "");
    if (document.querySelector("#status-content")) {
      updatePanel("#status-content", `<p class="muted">Загружаю статус...</p>`);
    }

    try {
      state.status = await api("/api/status");
      if (document.querySelector("#status-content")) {
        updatePanel("#status-content", renderStatus());
      }
    } catch (error) {
      state.status = null;
      if (document.querySelector("#status-content")) {
        updatePanel("#status-content", `<p class="muted">Статус недоступен</p>`);
        handleApiError(error, "#status-feedback");
      }
    } finally {
      state.statusLoading = false;
      renderStatusBanner();
      updatePaymentFormState();
    }
  };

  if (quiet || !card) {
    await fetchStatus();
    return;
  }

  await withBusy(card, fetchStatus);
}

export async function loadAllInvoices({ quiet = false } = {}) {
  const card = document.querySelector("#all-invoices-content")?.closest(".card");

  const fetchInvoices = async () => {
    updatePanel("#all-invoices-feedback", "");
    if (document.querySelector("#all-invoices-content")) {
      updatePanel("#all-invoices-content", `<p class="muted">Загружаю...</p>`);
    }

    try {
      state.allInvoices = await api("/admin/invoices");
      updatePanel("#all-invoices-content", renderAllInvoicesList());
    } catch (error) {
      handleApiError(error, "#all-invoices-feedback");
    }
  };

  if (quiet || !card) {
    await fetchInvoices();
    return;
  }

  await withBusy(card, fetchInvoices);
}

export async function checkInvoices() {
  const card = document.querySelector("#invoices-content")?.closest(".card");
  await withBusy(card, async () => {
    updatePanel("#invoices-feedback", "");
    updatePanel("#invoices-content", `<p class="muted">Проверяю платежи...</p>`);
    try {
      state.checkedInvoices = await api("/admin/invoices/check");
      updatePanel("#invoices-content", renderCheckedInvoices());
    } catch (error) {
      handleApiError(error, "#invoices-feedback");
    }
  });
}

export async function refreshProfile() {
  const card = document.querySelector('[data-action="refresh-profile"]')?.closest(".card");
  await withBusy(card, async () => {
    updatePanel("#profile-invoices-feedback", "");
    updatePanel("#profile-invoices", `<p class="muted">Обновляю...</p>`);

    const statusRefresh = loadStatus({ quiet: true });

    try {
      state.user = await api("/user/me");
      updatePanel("#welcome-info", welcomeContent());
      updatePanel("#profile-invoices", renderProfileInvoicesList());
    } catch (error) {
      handleApiError(error, "#profile-invoices-feedback");
    }

    await statusRefresh;
  });
}

export async function createPayment(form) {
  if (isPaymentBlocked()) {
    updatePaymentFormState();
    return;
  }

  await withBusy(form.closest(".card"), async () => {
    updatePanel("#profile-invoices-feedback", "");
    const data = formData(form);
    const invoice = await api("/tw/new-invoice", {
      method: "POST",
      body: JSON.stringify({
        amount: toNumber(data.amount),
        return_url: window.location.href,
        fail_url: window.location.href,
      }),
    });

    window.open(invoice.confirmation_url, "_blank", "noopener,noreferrer");

    state.user = await api("/user/me");
    updatePanel("#profile-invoices", renderProfileInvoicesList());
    showFeedback("#profile-invoices-feedback", ui.status("Счёт создан, открыта страница оплаты"));
  });
}
