export const ADMIN_PATH = "/admin";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const adminRoutes = {
  login: `${ADMIN_PATH}/login`,
  dashboard: ADMIN_PATH,
  menu: `${ADMIN_PATH}/menu`,
  modifiers: `${ADMIN_PATH}/modifiers`,
  kitchen: `${ADMIN_PATH}/kitchen`,
  pos: `${ADMIN_PATH}/pos`,
  reports: `${ADMIN_PATH}/reports`,
  financials: `${ADMIN_PATH}/financials`,
  customers: `${ADMIN_PATH}/customers`,
  display: `${base}/display`,
  settings: `${ADMIN_PATH}/settings`,
  system: `${ADMIN_PATH}/system`,
  paymentEvents: `${ADMIN_PATH}/payment-events`,
};
