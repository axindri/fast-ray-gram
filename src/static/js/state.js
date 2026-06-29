import { emptyPagination } from "./pagination.js";

export const configDefaults = {
  version: "",
  minInvoiceAmount: 100,
  maxInvoiceAmount: 1000,
  defaultExpiryTimeDays: 30,
};

export const app = document.querySelector("#app");
export const storageKey = "fast-ray-token";

export const state = {
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
