export type UserRole = "user" | "admin" | "superuser";

export type UserProfile = {
  id: number;
  username: string;
  role: UserRole;
  sub_url: string;
  invoices: Invoice[];
};

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Пользователь",
  admin: "Администратор",
  superuser: "Суперпользователь",
};

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "superuser";
}

export type ServiceStatusItem = {
  status: string;
  version?: string;
};

export type StatusResponse = Record<string, ServiceStatusItem | string[]>;

export const STATUS_META_KEYS = new Set(["avilable_statuses", "available_statuses"]);

export function getStatusServices(status: StatusResponse): [string, ServiceStatusItem][] {
  return Object.entries(status).filter(
    (entry): entry is [string, ServiceStatusItem] =>
      !STATUS_META_KEYS.has(entry[0]) && typeof entry[1] === "object" && entry[1] !== null && "status" in entry[1],
  );
}

export function getUnavailableServiceNames(status: StatusResponse): string[] {
  return getStatusServices(status)
    .filter(([, item]) => item.status !== "ok")
    .map(([name]) => name);
}

export type AdminLinks = {
  swagger_url: string;
  xui_panel_url: string;
  servers_url: string;
};

export const ADMIN_LINKS_META = [
  { key: "swagger_url" as const, title: "Swagger", hint: "Документация API" },
  { key: "xui_panel_url" as const, title: "XUI Panel", hint: "Панель управления" },
  { key: "servers_url" as const, title: "TimeWeb Servers", hint: "Серверы в панели TimeWeb" },
];

export type Invoice = {
  id: number;
  invoice_id: number;
  user_id: number;
  amount: number;
  payment_uuid: string;
  confirmation_url: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AdminInvoice = Invoice & {
  username: string;
  mark: string;
  sub_url: string;
  amount: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачено",
  cancelled: "Отменён",
};

export function invoiceStatusColor(status: string) {
  if (status === "pending") return "gold";
  if (status === "paid") return "green";
  return "default";
}

export type AdminUser = {
  id: number;
  username: string;
  role: UserRole;
  mark: string;
  sub_url: string;
};

export type CreateUserPayload = {
  username: string;
  role: UserRole;
  mark?: string;
  flow?: string;
  limit_ips?: number;
  total_gb?: number;
  expiry_time_days?: number;
  enable?: boolean;
};

export type XuiClient = {
  id: number;
  email: string;
  sub_id: string;
  sub_url: string;
  uuid: string;
  flow: string;
  limit_ips: number;
  total_gb: number;
  enable: boolean;
  expiry_datetime: string;
  comment: string;
  used_traffic: number;
  inbound_ids: number[];
};

export type AppConfig = {
  version: string;
  min_invoice_amount: number;
  max_invoice_amount: number;
  default_expiry_time_days: number;
};
