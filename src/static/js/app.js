import { initFooterOneko } from "./oneko-header.js";

const configDefaults = {
  version: "",
  minInvoiceAmount: 100,
  maxInvoiceAmount: 1000,
  defaultExpiryTimeDays: 30,
};

const app = document.querySelector("#app");
const storageKey = "fast-ray-token";

const state = {
  token: localStorage.getItem(storageKey) || "",
  user: null,
  isAdmin: false,
  status: null,
  statusLoading: false,
  checkedInvoices: null,
  allInvoices: emptyPagination(),
  config: { ...configDefaults },
  adminLinks: null,
};

function computePages(total, limit) {
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeTotal = Math.max(0, Number(total) || 0);
  return Math.max(1, Math.ceil(safeTotal / safeLimit) || 1);
}

function clampPage(page, pages) {
  const safePages = Math.max(1, Number(pages) || 1);
  const safePage = Math.max(1, Number(page) || 1);
  return Math.min(safePage, safePages);
}

function normalizePaginated(data, fallback = {}) {
  if (Array.isArray(data)) {
    const limit = Math.max(data.length, 1);
    return {
      items: data,
      total: data.length,
      page: 1,
      limit,
      pages: 1,
    };
  }

  const limit = data?.limit ?? fallback.limit ?? 3;
  const total = data?.total ?? 0;
  const pages = data?.pages ?? computePages(total, limit);
  const page = clampPage(data?.page ?? fallback.page ?? 1, pages);

  return {
    items: data?.items ?? [],
    total,
    page,
    limit,
    pages,
  };
}

function emptyPagination(limit = 3) {
  return { items: [], total: 0, page: 1, limit, pages: 1 };
}

let logoutHandler = () => {};

function onLogout(handler) {
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

async function loadAppConfig() {
  try {
    state.config = mapAppConfig(await api("/api/config"));
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

function isUnauthorized(error) {
  return error?.status === 401 || isInvalidToken(error);
}

function buildAuthLink(token = state.token) {
  const url = new URL("/", window.location.origin);
  if (token) {
    url.searchParams.set("authToken", token);
  }
  return url.toString();
}

function clearAuth() {
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

function logoutToLogin(message = "Сессия истекла, войдите заново") {
  clearAuth();
  logoutHandler(message);
}

function handleApiError(error, panelSelector) {
  if (isUnauthorized(error)) {
    logoutToLogin(error.message);
    return;
  }

  if (panelSelector) {
    updatePanel(panelSelector, ui.apiError(error.message));
  }
}

async function api(path, options = {}) {
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

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const ui = {
  button: (text, action, kind = "primary") => `<button class="btn ${kind}" data-action="${action}" type="button">${text}</button>`,
  card: (title, body, hint = "", footerId = "") => `
    <section class="card">
      <header>
        <div>
          <h2>${title}</h2>
          ${hint ? `<p class="muted">${hint}</p>` : ""}
        </div>
      </header>
      ${body}
      ${footerId ? `<div class="card-footer" id="${footerId}"></div>` : ""}
    </section>
  `,
  field: (name, label, type = "text", value = "", extra = "") => `
    <label class="field">
      <span>${label}</span>
      <input class="input" name="${name}" type="${type}" value="${value}" ${extra} />
    </label>
  `,
  readonly: (label, value, highlight = false) => `
    <label class="field">
      <span>${label}</span>
      <div class="copy-field">
        <input class="input${highlight ? " input--highlight" : ""}" value="${escapeHtml(value)}" readonly />
        <button class="btn ghost" data-copy type="button">Скопировать</button>
      </div>
    </label>
  `,
  authLinkResult: (link) => `
    <div class="stack auth-link-result">
      <label class="field">
        <span>Ссылка для входа</span>
        <input class="input" value="${escapeHtml(link)}" readonly data-auth-link />
      </label>
      <div class="row">
        <button class="btn ghost" type="button" data-copy-auth-link>Скопировать</button>
        <a class="btn primary" href="${escapeHtml(link)}">Авторизоваться</a>
      </div>
    </div>
  `,
  select: (name, label, options) => `
    <label class="field">
      <span>${label}</span>
      <select class="input" name="${name}">
        ${options.map((item) => `<option value="${item}">${item}</option>`).join("")}
      </select>
    </label>
  `,
  status: (text, ok = true) => `<div class="status ${ok ? "ok" : "error"}">${text}</div>`,
  apiError: (text) => `<div class="status error mono">${text}</div>`,
  service: (name, item = {}) => {
    const status = String(item.status || "warning").toLowerCase();
    const version = item.version ? `v${item.version}` : "без версии";
    return `
      <div class="service ${status}">
        <span class="dot"></span>
        <div>
          <b>${name}</b>
          <span>${status} · ${version}</span>
        </div>
      </div>
    `;
  },
};

function shell(content) {
  app.innerHTML = `
    <div class="shell">
      <nav class="topbar">
        <div class="brand"><h1>Fast Ray Gra<span class="oneko-seat">m</span></h1></div>
      </nav>
${content}
      ${
        state.token
          ? `
      <footer class="app-footer">
        <div class="app-version" id="app-version"></div>
        ${ui.button("Выйти", "logout", "danger")}
      </footer>`
          : ""
      }
    </div>
  `;

  requestAnimationFrame(() => {
    app.querySelector(".shell")?.classList.add("is-visible");
    initFooterOneko();
  });

  renderAppVersion();
  updatePaymentFormState();
}

const STATUS_META_KEYS = new Set(["avilable_statuses", "available_statuses"]);

function getStatusServices(status = state.status) {
  if (!status) {
    return [];
  }

  return Object.entries(status)
    .filter(([key, item]) => !STATUS_META_KEYS.has(key) && item && typeof item === "object" && "status" in item)
    .map(([name, item]) => ({ name, item }));
}

function hasServiceIssues() {
  if (!state.status) {
    return false;
  }

  return getStatusServices().some(({ item }) => String(item.status || "").toLowerCase() !== "ok");
}

function renderServiceAlert() {
  if (state.statusLoading) {
    return "";
  }

  if (!state.status) {
    return `<div class="status error">Не удалось проверить статус сервисов. Создание и оплата счетов недоступны.</div>`;
  }

  if (!hasServiceIssues()) {
    return "";
  }

  return `<div class="status error">Часть сервисов недоступна. Создание и оплата счетов временно отключены.</div>`;
}

function renderWelcomeAside() {
  const alert = renderServiceAlert();
  if (alert) {
    return alert;
  }

  if (state.statusLoading) {
    return "";
  }

  return `<p class="welcome-note">${pickWelcomeNote()}</p>`;
}

function updateServicePanels() {
  const aside = renderWelcomeAside();
  const alertPanel = document.querySelector("#service-alert");
  if (alertPanel) {
    alertPanel.innerHTML = aside;
    alertPanel.hidden = !aside;
  }
  updatePanel("#status-content", renderStatus());
  updatePaymentFormState();
}

function isPaymentBlocked() {
  return state.statusLoading || !state.status || hasServiceIssues();
}

function renderPayControl(confirmationUrl) {
  if (!confirmationUrl) {
    return "";
  }

  if (isPaymentBlocked()) {
    return `<button class="btn primary invoice-pay" type="button" disabled>Оплатить</button>`;
  }

  return `<a class="btn primary invoice-pay" href="${confirmationUrl}" target="_blank" rel="noreferrer">Оплатить</a>`;
}

function updateInvoicePayButtons() {
  document.querySelectorAll(".invoice-pay-slot").forEach((slot) => {
    const url = slot.dataset.confirmationUrl;
    if (!url) {
      return;
    }

    slot.innerHTML = renderPayControl(url);
  });
}

function updatePaymentFormHint() {
  const hint = document.querySelector("#payment-status-hint");
  if (!hint) {
    return;
  }

  hint.classList.remove("is-loading", "hide");

  if (state.statusLoading) {
    hint.textContent = "Загружаем статус сервисов...";
    hint.classList.add("is-loading");
    return;
  }

  hint.textContent = "";
  hint.classList.add("hide");
}

function updatePaymentFormState() {
  updateInvoicePayButtons();

  const form = document.querySelector('[data-form="new-payment"]');

  if (form) {
    const blocked = isPaymentBlocked();
    form.querySelectorAll("input, button").forEach((element) => {
      element.disabled = blocked;
    });
  }

  updatePaymentFormHint();
}

function renderAppVersion() {
  const el = document.querySelector("#app-version");
  const version = state.config?.version;
  if (!el || !version) {
    return;
  }

  el.textContent = `v${version}`;
}

function updatePanel(id, html) {
  const panel = document.querySelector(id);
  if (panel) {
    panel.innerHTML = html;
  }
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function toNumber(value) {
  return value === "" ? 0 : Number(value);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("ru-RU");
}

function setBusy(container, busy) {
  const root = container || app;
  root.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
    button.classList.toggle("busy", busy);
  });
}

async function withBusy(container, fn) {
  setBusy(container, true);
  try {
    return await fn();
  } finally {
    setBusy(container, false);
    updatePaymentFormState();
  }
}

async function withOptionalBusy(container, quiet, fn) {
  if (quiet || !container) {
    return fn();
  }

  return withBusy(container, fn);
}

const deleteConfirmTimers = new WeakMap();

function clearDeleteConfirmTimer(button) {
  const timer = deleteConfirmTimers.get(button);
  if (timer) {
    clearTimeout(timer);
    deleteConfirmTimers.delete(button);
  }
}

function resetDeleteConfirm(target) {
  const button = target?.matches?.('button[value="delete"]') ? target : target?.querySelector?.('button[value="delete"]');

  if (!button) {
    return;
  }

  clearDeleteConfirmTimer(button);
  delete button.dataset.confirm;
  button.textContent = button.dataset.originalText || "Удалить";
  delete button.dataset.originalText;
  button.classList.add("danger");
  button.classList.remove("ghost");
}

function armDeleteConfirm(button) {
  clearDeleteConfirmTimer(button);
  button.dataset.confirm = "yes";
  button.dataset.originalText = button.textContent;
  button.textContent = "Подтвердить удаление";
  button.classList.remove("danger");
  button.classList.add("ghost");

  const timer = setTimeout(() => resetDeleteConfirm(button), 5000);
  deleteConfirmTimers.set(button, timer);
}

function prepareFormAction(form, submitter) {
  const action = submitter.value;

  if (action !== "delete") {
    resetDeleteConfirm(form);
  }

  if (needsDeleteConfirm(action, submitter)) {
    return null;
  }

  return action;
}

function needsDeleteConfirm(action, submitter) {
  if (action !== "delete" || submitter.dataset.confirm === "yes") {
    return false;
  }

  armDeleteConfirm(submitter);
  return true;
}

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

const STATUS_POLL_MS = 60_000;
let statusPollTimer = null;

const WELCOME_NOTES = [
  "Сегодня хороший день, чтобы сделать что-то полезное.",
  "Один шаг за раз — и цель становится ближе.",
  "Главное — начать, остальное приложится.",
  "Дисциплина сегодня — свобода завтра.",
  "Не откладывай на потом то, что можно сделать сейчас.",
  "Маленький прогресс лучше, чем идеальный план без действий.",
];

function pickWelcomeNote() {
  return WELCOME_NOTES[Math.floor(Math.random() * WELCOME_NOTES.length)];
}

function loginInfoContent() {
  return `
    <div class="stack login-info">
      <p>Токен для входа выдаёт администратор — напишите ему в личные сообщения.</p>
      <p>Если что-то не работает, обратитесь в ЛС группы или к администратору.</p>
    </div>
  `;
}

function displayName(username = "") {
  return username ? username.charAt(0).toUpperCase() + username.slice(1) : "друг";
}

function roleLabel(role) {
  return ROLE_LABELS[role] || "";
}

function defaultExpiryDays() {
  return state.config?.defaultExpiryTimeDays ?? 30;
}

function welcomeContent() {
  const subUrl = state.user?.sub_url || "";
  const role = state.user?.role || "";
  const showRole = role === "admin" || role === "superuser";

  return `
    <div class="stack welcome-body">
      <div class="welcome-head">
        <h2 class="welcome-title">Привет, ${displayName(state.user?.username)}!</h2>
        ${showRole ? `<p class="welcome-role">${roleLabel(role)}</p>` : ""}
      </div>
      <div id="service-alert" hidden></div>
      ${subUrl ? ui.readonly("Ссылка подписки", subUrl, true) : ""}
    </div>
  `;
}

function stopStatusPolling() {
  if (statusPollTimer === null) {
    return;
  }

  clearInterval(statusPollTimer);
  statusPollTimer = null;
}

function startStatusPolling() {
  stopStatusPolling();
  statusPollTimer = setInterval(() => {
    loadStatus({ poll: true });
  }, STATUS_POLL_MS);
}

async function renderLogin(message = "") {
  stopStatusPolling();

  shell(`
    <div class="grid">
      ${ui.card(
        "Вход",
        `<form class="form" data-form="login">
          ${ui.field("token", "Авторизационный токен", "password", state.token, "autocomplete='current-password'")}
          <button class="btn primary" type="submit">Войти</button>
          ${message ? ui.apiError(message) : ""}
        </form>`,
      )}
      ${ui.card("Привет!", loginInfoContent())}
    </div>
  `);
}

async function renderDashboard() {
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
      { id: "invoices", title: "Инвойсы", gridClass: "dashboard-group-grid dashboard-group-grid--invoices", items: [invoicesBlock(), cancelInvoiceBlock(), allInvoicesBlock()] },
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
      const gridClass = group.gridClass ?? (group.items.length === 1 ? "dashboard-group-grid dashboard-group-grid--single" : "dashboard-group-grid");

      return `
        <section class="dashboard-group" id="group-${group.id}">
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
  if (status !== "pending" || !item.confirmation_url) {
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
      <span>ID записи: ${item.id}</span>
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

async function loadAdminLinks({ quiet = false } = {}) {
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
      ${ui.button("Проверить", "check-invoices")}
      <div id="invoices-content" class="list">${renderCheckedInvoices()}</div>
    </div>`,
    "",
    "invoices-feedback",
  );
}

function cancelInvoiceBlock() {
  return ui.card(
    "Отменить инвойс",
    `<form class="form" data-form="cancel-invoice">
      ${ui.field("id", "ID записи", "number", "", 'placeholder="1" required')}
      <button class="btn danger" type="submit">Отменить</button>
    </form>`,
    "Принудительно перевести инвойс в статус «Отменён»",
    "cancel-invoice-feedback",
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

function renderStatus() {
  if (!state.status) {
    return `<p class="muted">Загружаю статус...</p>`;
  }

  return getStatusServices()
    .map(({ name, item }) => ui.service(name, item))
    .join("");
}

async function loadStatus({ quiet = false, poll = false, bypassCache = false } = {}) {
  const card = document.querySelector("#status-content")?.closest(".card");
  const silent = poll || (quiet && state.status !== null);

  await withOptionalBusy(card, quiet || poll || !card, async () => {
    if (!silent) {
      state.statusLoading = true;
      updateServicePanels();
      updatePanel("#status-feedback", "");
    }

    try {
      const headers = bypassCache ? { "Cache-Control": "no-cache" } : {};
      const response = await fetch("/api/status", { headers });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.detail || response.statusText;
        throw Object.assign(new Error(message), { status: response.status });
      }
      state.status = await response.json();
    } catch (error) {
      if (isUnauthorized(error)) {
        stopStatusPolling();
        logoutToLogin(error.message);
        return;
      }

      state.status = null;
      if (!silent) {
        handleApiError(error, "#status-feedback");
      }
    } finally {
      state.statusLoading = false;
      updateServicePanels();
    }
  });
}

async function loadAllInvoices({ quiet = false, page = state.allInvoices?.page ?? 1 } = {}) {
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

async function checkInvoices() {
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

async function refreshProfile() {
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

async function createPayment(form) {
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

onLogout(renderLogin);

const formHandlers = {
  login: submitLogin,
  "create-user": submitCreateUser,
  "user-actions": submitUserActions,
  "xui-client": submitXuiClient,
  "new-payment": (form) => createPayment(form),
  "cancel-invoice": submitCancelInvoice,
};

const formFeedback = {
  "create-user": "#create-user-feedback",
  "user-actions": "#user-manage-feedback",
  "xui-client": "#xui-feedback",
  "new-payment": "#profile-invoices-feedback",
  "cancel-invoice": "#cancel-invoice-feedback",
};

const actionHandlers = {
  logout: () => logoutToLogin(),
  "check-invoices": checkInvoices,
  "load-status": () => loadStatus({ bypassCache: true }),
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

async function submitCancelInvoice(form) {
  await withBusy(form.closest(".card"), async () => {
    updatePanel("#cancel-invoice-feedback", "");
    const { id } = formData(form);
    const invoice = await api(`/admin/invoices/${id}/cancel`, { method: "POST" });
    updatePanel("#cancel-invoice-feedback", ui.status(`Инвойс #${invoice.invoice_id} отменён`));
    if (state.isAdmin) {
      await loadAllInvoices({ quiet: true });
    }
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
    updatePanel("#user-manage-feedback", `<div class="item"><b>${result.username}</b><span>ID: ${result.id} · ${result.role}</span></div>`);
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
      updatePanel("#xui-feedback", `<div class="item"><b>${result.email}</b><span>до ${formatDate(result.expiry_datetime)} · ${result.total_gb} GB</span></div>`);
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
