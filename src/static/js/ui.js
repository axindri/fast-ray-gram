import { app, state } from "./state.js";
import { initFooterOneko } from "./oneko-header.js";

export const ui = {
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
  readonly: (label, value) => `
    <label class="field">
      <span>${label}</span>
      <div class="copy-field">
        <input class="input" value="${value}" readonly />
        <button class="btn ghost" data-copy type="button">Скопировать</button>
      </div>
    </label>
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

export function shell(content) {
  app.innerHTML = `
    <div class="shell">
      <nav class="topbar">
        <div class="brand"><h1>Fast Ray Gra<span class="oneko-seat">m</span></h1></div>
      </nav>
      <div id="status-banner" class="status-banner" role="status"></div>
      ${content}
      <footer class="app-footer">
        <div class="app-version" id="app-version"></div>
        ${state.token ? ui.button("Выйти", "logout", "danger") : ""}
      </footer>
    </div>
  `;

  requestAnimationFrame(() => {
    app.querySelector(".shell")?.classList.add("is-visible");
    initFooterOneko();
  });

  loadAppVersion();
  renderStatusBanner();
}

const serviceLabels = {
  API: "API",
  XUI: "XUI",
  TimeWeb: "TimeWeb",
};

export function hasServiceIssues() {
  if (!state.status) {
    return false;
  }

  return Object.keys(serviceLabels).some(
    (key) => String(state.status[key]?.status || "").toLowerCase() !== "ok",
  );
}

export function isPaymentBlocked() {
  return state.statusLoading || !state.status || hasServiceIssues();
}

export function renderPayControl(confirmationUrl) {
  if (!confirmationUrl) {
    return "";
  }

  if (isPaymentBlocked()) {
    return `<button class="btn primary invoice-pay" type="button" disabled>Оплатить</button>`;
  }

  return `<a class="btn primary invoice-pay" href="${confirmationUrl}" target="_blank" rel="noreferrer">Оплатить</a>`;
}

export function updateInvoicePayButtons() {
  document.querySelectorAll(".invoice-pay-slot").forEach((slot) => {
    const url = slot.dataset.confirmationUrl;
    if (!url) {
      return;
    }

    slot.innerHTML = renderPayControl(url);
  });
}

const paymentFormHintMessages = {
  loading: "Загружаем статус сервисов...",
  failed: "Не удалось проверить статус сервисов. Платёж недоступен.",
  blocked: "Платёж недоступен: есть проблемы с сервисами.",
};

const invoicePayHintMessages = {
  loading: "Оплатить счета нельзя — загружаем статус сервисов.",
  failed: "Оплатить счета нельзя — не удалось проверить статус сервисов.",
  blocked: "Оплатить счета нельзя, пока есть проблемы с сервисами.",
};

function fillPaymentHint(hint, messages) {
  if (!hint) {
    return;
  }

  hint.classList.remove("is-loading", "is-blocked", "hide");

  if (state.statusLoading) {
    hint.textContent = messages.loading;
    hint.classList.add("is-loading");
    return;
  }

  if (!state.status) {
    hint.textContent = messages.failed;
    hint.classList.add("is-blocked");
    return;
  }

  if (hasServiceIssues()) {
    hint.textContent = messages.blocked;
    hint.classList.add("is-blocked");
    return;
  }

  hint.textContent = "";
  hint.classList.add("hide");
}

export function updatePaymentFormState() {
  updateInvoicePayButtons();

  const form = document.querySelector('[data-form="new-payment"]');
  const formHint = document.querySelector("#payment-status-hint");

  if (form) {
    const blocked = isPaymentBlocked();
    form.querySelectorAll("input, button").forEach((element) => {
      element.disabled = blocked;
    });
  }

  fillPaymentHint(formHint, paymentFormHintMessages);

  document.querySelectorAll("[data-invoice-pay-hint]").forEach((hint) => {
    fillPaymentHint(hint, invoicePayHintMessages);
  });
}

export function renderStatusBanner() {
  const banner = document.querySelector("#status-banner");
  if (!banner) {
    return;
  }

  if (state.statusLoading || !state.status) {
    banner.textContent = "";
    banner.classList.remove("is-visible");
    updatePaymentFormState();
    return;
  }

  const issues = Object.entries(serviceLabels)
    .filter(([key]) => String(state.status?.[key]?.status || "").toLowerCase() !== "ok")
    .map(([, label]) => label);

  if (!issues.length) {
    banner.textContent = "";
    banner.classList.remove("is-visible");
    updatePaymentFormState();
    return;
  }

  banner.textContent = `Внимание: проблемы с сервисами — ${issues.join(", ")}`;
  requestAnimationFrame(() => {
    banner.classList.add("is-visible");
  });

  updatePaymentFormState();
}

export function renderAppVersion() {
  const el = document.querySelector("#app-version");
  const version = state.config?.version;
  if (!el || !version) {
    return;
  }

  el.textContent = `v${version}`;
}

function loadAppVersion() {
  renderAppVersion();
}

export function updatePanel(id, html) {
  const panel = document.querySelector(id);
  if (panel) {
    panel.innerHTML = html;
  }
}

export function showFeedback(id, html) {
  updatePanel(id, html);
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function toNumber(value) {
  return value === "" ? 0 : Number(value);
}

export function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("ru-RU");
}

export function setBusy(container, busy) {
  const root = container || app;
  root.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
    button.classList.toggle("busy", busy);
  });
}

export async function withBusy(container, fn) {
  setBusy(container, true);
  try {
    return await fn();
  } finally {
    setBusy(container, false);
    updatePaymentFormState();
  }
}

const deleteConfirmTimers = new WeakMap();

function clearDeleteConfirmTimer(button) {
  const timer = deleteConfirmTimers.get(button);
  if (timer) {
    clearTimeout(timer);
    deleteConfirmTimers.delete(button);
  }
}

export function resetDeleteConfirm(target) {
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

export function needsDeleteConfirm(action, submitter) {
  if (action !== "delete" || submitter.dataset.confirm === "yes") {
    return false;
  }

  armDeleteConfirm(submitter);
  return true;
}
