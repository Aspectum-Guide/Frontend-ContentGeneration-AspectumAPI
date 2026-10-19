const modalStack = [];

export function registerModal(token) {
  modalStack.push(token);
}

export function unregisterModal(token) {
  const index = modalStack.lastIndexOf(token);
  if (index >= 0) modalStack.splice(index, 1);
}

export function isTopModal(token) {
  return modalStack.at(-1) === token;
}
