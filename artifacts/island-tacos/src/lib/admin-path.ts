const raw = import.meta.env.VITE_ADMIN_PATH as string | undefined;
export const ADMIN_PATH = raw ? `/${raw}` : "/it-admin";

export const adminRoutes = {
  login: `${ADMIN_PATH}/login`,
  dashboard: ADMIN_PATH,
  menu: `${ADMIN_PATH}/menu`,
  kitchen: `${ADMIN_PATH}/kitchen`,
  pos: `${ADMIN_PATH}/pos`,
};
