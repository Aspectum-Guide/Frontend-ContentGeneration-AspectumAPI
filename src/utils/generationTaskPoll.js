import { isNotFoundError } from './apiError';

export const TASK_NOT_FOUND_MESSAGE =
  'Задача генерации не найдена. Попробуйте запустить генерацию заново.';

export const TASK_POLL_TIMEOUT_MESSAGE =
  'Превышено время ожидания генерации. Попробуйте снова или уменьшите объём запроса.';

export const TASK_POLL_CANCELLED = '__generation_task_poll_cancelled__';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollGenerationTask(
  taskId,
  {
    tasksAPI,
    intervalMs = 2000,
    maxWaitMs = 15 * 60 * 1000,
    isCancelled = () => false,
    onProgress = null,
  } = {},
) {
  if (!taskId) {
    throw new Error(TASK_NOT_FOUND_MESSAGE);
  }

  const deadline = Date.now() + maxWaitMs;

  while (true) {
    if (isCancelled()) {
      const err = new Error(TASK_POLL_CANCELLED);
      err.code = TASK_POLL_CANCELLED;
      throw err;
    }

    if (Date.now() >= deadline) {
      throw new Error(TASK_POLL_TIMEOUT_MESSAGE);
    }

    let task;
    try {
      const response = await tasksAPI.get(taskId);
      task = response?.data;
    } catch (err) {
      if (isNotFoundError(err)) {
        throw new Error(TASK_NOT_FOUND_MESSAGE);
      }
      const status = err?.response?.status;
      // 5xx ИЛИ сетевой сбой (нет response: обрыв сети, рестарт dev-сервера,
      // ноутбук проснулся) — задача на бэке живёт, поллинг не сдаётся.
      if (!err?.response || (status && status >= 500)) {
        await sleep(intervalMs);
        continue;
      }
      throw err;
    }

    if (typeof onProgress === 'function') {
      onProgress(task);
    }

    const status = task?.status;
    if (status === 'completed') {
      return task;
    }

    if (status === 'failed' || status === 'cancelled') {
      const message =
        task?.error_message ||
        task?.result_data?.error ||
        (status === 'cancelled'
          ? 'Генерация отменена.'
          : 'Задача завершилась с ошибкой');
      throw new Error(message);
    }

    if (status && TERMINAL_STATUSES.has(status)) {
      throw new Error(task?.error_message || 'Задача завершилась с ошибкой');
    }

    await sleep(intervalMs);
  }
}

export function isPollCancelledError(error) {
  return error?.code === TASK_POLL_CANCELLED || error?.message === TASK_POLL_CANCELLED;
}
