import { AsyncLocalStorage } from 'node:async_hooks';
const budgets = new AsyncLocalStorage<number>();
export function withProviderDeadline<T>(
  deadline: number,
  work: () => Promise<T>,
): Promise<T> {
  return budgets.run(deadline, work);
}
export function remainingProviderTime(defaultTimeout: number): number {
  const deadline = budgets.getStore();
  return deadline === undefined
    ? defaultTimeout
    : Math.max(1, Math.min(defaultTimeout, deadline - Date.now()));
}

export function providerDeadline(): number | undefined {
  return budgets.getStore();
}
