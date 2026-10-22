// Minimal in-page router: pages register an onEnter hook; navigate() switches the visible page.

const routes = new Map();
let listener = () => {};

export const registerRoute = (id, onEnter = () => {}) => routes.set(id, onEnter);
export const onNavigate = fn => { listener = fn; };

export function navigate(id) {
  if (!routes.has(id)) id = "dashboard";
  listener(id);
  routes.get(id)();
}
