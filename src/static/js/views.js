import { api, handleApiError, isUnauthorized, loadAppConfig, logoutToLogin } from "./api.js";
import { clampPage, emptyPagination, normalizePaginated } from "./pagination.js";
import { pickQuote, renderQuote } from "./quotes.js";
import { state } from "./state.js";
import {
  formatDate,
  formData,
  getStatusServices,
  isPaymentBlocked,
  renderPayControl,
  renderStatusBanner,
  shell,
  toNumber,
  ui,
  updatePanel,
  updatePaymentFormState,
  withBusy,
  withOptionalBusy,
} from "./ui.js";

const ROLE_LABELS = {
  admin: "Администратор",
  superuser: "Суперпользователь",
};

const ADMIN_LINKS = [
  { key: "swagger_url", className: "swagger", title: "Swagger", hint: "Документация API" },
  { key: "xui_panel_url", className: "panel", title: "XUI Panel", hint: "Панель управления" },
  { key: "servers_url", className: "servers", title: "TimeWeb Servers", hint: "Серверы в панели TimeWeb" },
];

const invoiceStatusLabels = {
  pending: "Ожидает оплаты",
  paid: "Оплачено",
  cancelled: "Отменён",
};

const STATUS_POLL_MS = 10_000;
let statusPollTimer = null;

function displayName(username = "") {
  return username ? username.charAt(0).toUpperCase() + username.slice(1) : "друг";
}

function roleLabel(role) {
  return ROLE_LABELS[role] || "";
}

function defaultExpiryDays() {
  return state.config?.defaultExpiryTimeDays ?? 30;
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

export function stopStatusPolling() {
  if (statusPollTimer === null) {
    return;
  }

  clearInterval(statusPollTimer);
  statusPollTimer = null;
}

export function startStatusPolling() {
  stopStatusPolling();
  statusPollTimer = setInterval(() => {
    loadStatus({ poll: true });
  }, STATUS_POLL_MS);
}

export async function renderLogin(message = "") {
  stopStatusPolling();
  await loadAppConfig();

  shell(`
    <div class="grid">
      ${ui.card(
        "Вход",
        `<form class="form" data-form="login">
          ${ui.field("token", "Авторизационный токен", "password", state.token, "autocomplete='current-password'")}
          <button class="btn primary" type="submit">Войти</button>
          ${message ? ui.apiError(message) : ""}
        </form>`,
        "Для получения авторизационного токена, обратитесь к администратору",
      )}
      ${ui.card("На сегодня", renderQuote(pickQuote()))}
    </div>
  `);
}

export async function renderDashboard() {
  await loadAppConfig();

  state.statusLoading = true;

  const groups = buildDashboardGroups();

  shell(`
    <div class="dashboard-layout">
      ${renderDashboardNav(groups)}
      <div class="dashboard-content">
        ${renderDashboardGroups(groups)}
      </div>
    </div>
  `);
  updatePaymentFormState();

  requestAnimationFrame(() => {
    void initDashboardData();
  });
}

async function initDashboardData() {
  await loadStatus({ quiet: true });
  startStatusPolling();

  if (state.isAdmin) {
    loadAllInvoices({ quiet: true });
    loadAdminLinks({ quiet: true });
  }
}

function buildDashboardGroups() {
  const groups = [{ id: "home", title: "Главная", items: [welcomeBlock()] }];

  if (state.user?.role !== "superuser") {
    groups.push({ id: "payments", title: "Платежи", items: [profileInvoicesBlock()] });
  }

  if (state.isAdmin) {
    groups.push(
      { id: "panels", title: "Панели", items: [adminLinksBlock()] },
      { id: "monitoring", title: "Мониторинг", items: [statusBlock()] },
      { id: "invoices", title: "Инвойсы", items: [invoicesBlock(), allInvoicesBlock()] },
      { id: "users", title: "Пользователи", items: [adminCreateUserBlock(), adminUserManageBlock()] },
      { id: "xui", title: "XUI", items: [xuiBlock()] },
    );
  }

  return groups;
}

function renderDashboardNav(groups) {
  return `
    <nav class="dashboard-nav" aria-label="Разделы">
      ${groups.map((group) => `<a class="dashboard-nav-link" href="#group-${group.id}">${group.title}</a>`).join("")}
    </nav>
  `;
}

function renderDashboardGroups(groups) {
  return groups
    .map((group) => {
      const gridClass = group.items.length === 1 ? "dashboard-group-grid dashboard-group-grid--single" : "dashboard-group-grid";

      return `
        <section class="dashboard-group" id="group-${group.id}">
          <h2 class="dashboard-group-title">${group.title}</h2>
          <div class="${gridClass}">
            ${group.items.join("")}
          </div>
        </section>
      `;
    })
    .join("");
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

  return invoices.map((item) => invoiceItem(item)).join("");
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
      <div id="profile-invoices" class="list profile-invoices-scroll">${renderProfileInvoicesList()}</div>
    </div>`,
    "",
    "profile-invoices-feedback",
  );
}

function invoiceStatusPill(status) {
  const value = String(status || "").toLowerCase();
  const label = invoiceStatusLabels[value] || value || "—";
  return `<span class="pill${invoiceStatusLabels[value] ? ` ${value}` : ""}">${label}</span>`;
}

function invoicePaySlot(item) {
  const status = String(item.status || "").toLowerCase();
  if (status === "cancelled" || !item.confirmation_url) {
    return "";
  }

  return `<div class="invoice-pay-slot" data-confirmation-url="${item.confirmation_url}">${renderPayControl(item.confirmation_url)}</div>`;
}

function invoiceItem(item, { admin = false } = {}) {
  const userBlock = admin
    ? `
      <span>Пользователь: ${item.username || `ID ${item.user_id}`}</span>
      ${item.mark ? `<span>Заметка: ${item.mark}</span>` : ""}
      ${item.sub_url ? `<a class="invoice-sub-link" href="${item.sub_url}" target="_blank" rel="noreferrer">Ссылка подписки</a>` : ""}
      ${item.amount != null ? `<span>Сумма: ${item.amount} ₽</span>` : ""}
    `
    : "";

  return `
    <div class="item invoice">
      <div class="row between">
        <b>#${item.invoice_id}</b>
        ${invoiceStatusPill(item.status)}
      </div>
      ${userBlock}
      <span>Создан: ${formatDate(item.created_at)}</span>
      ${invoicePaySlot(item)}
    </div>
  `;
}

function paginationControls({ page, pages, total, prevAction, nextAction }) {
  return `
    <div class="pagination row between wrap">
      <span class="muted no-margin">Страница ${page} из ${pages} · всего ${total}</span>
      <div class="row">
        <button class="btn ghost" data-action="${prevAction}" type="button" ${page <= 1 ? "disabled" : ""}>Назад</button>
        <button class="btn ghost" data-action="${nextAction}" type="button" ${page >= pages ? "disabled" : ""}>Вперёд</button>
      </div>
    </div>
  `;
}

function adminLinksBlock() {
  return `
    <section class="card admin-panels-card">
      <header>
        <div>
          <h2>Панели</h2>
          <p class="muted">Swagger, XUI Panel и серверы TimeWeb</p>
        </div>
      </header>
      <div id="admin-links-content" class="admin-links-grid">
        <p class="muted">Загружаю...</p>
      </div>
    </section>
  `;
}

function renderAdminLinksContent() {
  const links = state.adminLinks;
  if (!links) {
    return `<p class="muted">Загружаю...</p>`;
  }

  return ADMIN_LINKS.map(({ key, className, title, hint }) => {
    const url = links[key];
    return `
      <a class="admin-link-card admin-link-card--${className}" href="${url}" target="_blank" rel="noreferrer">
        <span class="admin-link-title">${title}</span>
        <span class="admin-link-hint">${hint}</span>
        <span class="admin-link-url">${url}</span>
      </a>
    `;
  }).join("");
}

export async function loadAdminLinks({ quiet = false } = {}) {
  const card = document.querySelector("#admin-links-content")?.closest(".card");

  await withOptionalBusy(card, quiet, async () => {
    updatePanel("#admin-links-content", `<p class="muted">Загружаю...</p>`);

    try {
      state.adminLinks = await api("/admin/links");
      updatePanel("#admin-links-content", renderAdminLinksContent());
    } catch (error) {
      handleApiError(error);
      if (state.token) {
        updatePanel("#admin-links-content", ui.apiError(error.message));
      }
    }
  });
}

function adminCreateUserBlock() {
  const expiryDays = defaultExpiryDays();

  return ui.card(
    "Создать пользователя",
    `<form class="form" data-form="create-user">
      ${ui.field("username", "Username", "text", "", 'placeholder="user@example.com"')}
      ${ui.select("role", "Роль", ["user", "admin"])}
      ${ui.field("mark", "Заметка", "text", "", 'placeholder="Заметка или комментарий"')}
      ${ui.field("flow", "Flow", "text", "", 'placeholder="xtls-rprx-vision"')}
      <div class="row">
        ${ui.field("limit_ips", "Лимит IP", "number", "", 'placeholder="0"')}
        ${ui.field("total_gb", "Объем трафика", "number", "", 'placeholder="0"')}
        ${ui.field("expiry_time_days", "Срок действия", "number", "", `placeholder="${expiryDays}"`)}
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
      ${ui.field("id", "User ID", "number", "", 'placeholder="1"')}
      <div class="row wrap">
        <button class="btn ghost" name="action" value="get" type="submit">Получить</button>
        <button class="btn ghost" name="action" value="refresh" type="submit">Обновить токен</button>
        <button class="btn danger" name="action" value="delete" type="submit">Удалить</button>
      </div>
    </form>
    <div id="user-manage-auth-link" class="stack"></div>`,
    "Получение, refresh token и удаление",
    "user-manage-feedback",
  );
}

function xuiBlock() {
  const expiryDays = defaultExpiryDays();

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
      <p class="muted">Счета с данными пользователя.</p>
      <div id="all-invoices-content" class="list"><p class="muted">Загружаю...</p></div>
      <div id="all-invoices-pagination"></div>
    </div>`,
    "",
    "all-invoices-feedback",
  );
}

function renderAllInvoicesList() {
  const items = state.allInvoices?.items ?? [];

  if (!items.length) {
    return `<p class="muted">Инвойсов нет</p>`;
  }

  return items.map((item) => invoiceItem(item, { admin: true })).join("");
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

  return state.checkedInvoices.map((item) => invoiceItem(item)).join("");
}

export function renderStatus() {
  if (!state.status) {
    return `<p class="muted">Загружаю статус...</p>`;
  }

  return getStatusServices()
    .map(({ name, item }) => ui.service(name, item))
    .join("");
}

export async function loadStatus({ quiet = false, poll = false } = {}) {
  const card = document.querySelector("#status-content")?.closest(".card");
  const silent = poll || (quiet && state.status !== null);

  await withOptionalBusy(card, quiet || poll || !card, async () => {
    if (!silent) {
      state.statusLoading = true;
      renderStatusBanner();
      updatePaymentFormState();
      updatePanel("#status-feedback", "");
      updatePanel("#status-content", `<p class="muted">Загружаю статус...</p>`);
    }

    try {
      state.status = await api("/api/status");
      updatePanel("#status-content", renderStatus());
    } catch (error) {
      if (isUnauthorized(error)) {
        stopStatusPolling();
        logoutToLogin(error.message);
        return;
      }

      state.status = null;
      if (!silent) {
        updatePanel("#status-content", `<p class="muted">Статус недоступен</p>`);
        handleApiError(error, "#status-feedback");
      }
    } finally {
      if (!silent) {
        state.statusLoading = false;
      }
      if (state.token) {
        renderStatusBanner();
        updatePaymentFormState();
      }
    }
  });
}

export async function loadAllInvoices({ quiet = false, page = state.allInvoices?.page ?? 1 } = {}) {
  const card = document.querySelector("#all-invoices-content")?.closest(".card");
  const previous = state.allInvoices ?? emptyPagination();
  const targetPage = clampPage(page, previous.pages);

  await withOptionalBusy(card, quiet, async () => {
    updatePanel("#all-invoices-feedback", "");
    updatePanel("#all-invoices-content", `<p class="muted">Загружаю...</p>`);

    try {
      const data = await api(`/admin/invoices?page=${targetPage}&limit=${previous.limit}`);
      state.allInvoices = normalizePaginated(data, { ...previous, page: targetPage });
      updatePanel("#all-invoices-content", renderAllInvoicesList());
      updatePanel(
        "#all-invoices-pagination",
        paginationControls({
          ...state.allInvoices,
          prevAction: "invoices-prev",
          nextAction: "invoices-next",
        }),
      );
    } catch (error) {
      handleApiError(error, "#all-invoices-feedback");
    }
  });
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
    updatePanel("#profile-invoices-feedback", ui.status("Счёт создан, открыта страница оплаты"));
  });
}
