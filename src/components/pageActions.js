// Primary actions first, otherwise keep the order the page registered them in.
export function orderActions(actions) {
  return [
    ...actions.filter((action) => action.variant === 'primary'),
    ...actions.filter((action) => action.variant !== 'primary'),
  ];
}