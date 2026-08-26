import { AppError } from "./errors";

/**
 * A fetch that cannot hang forever.
 *
 * Nothing here had a timeout, and that is how a lecture ended up stranded: a
 * call to Google stopped responding, the function sat on it until the platform
 * killed the whole invocation, and because nothing threw, no catch ran and no
 * failure was ever recorded. The lecture just stayed on its stage looking busy.
 *
 * A timeout turns that silence into an error the pipeline can write down.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AppError("upstream_timeout", `no response within ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A stage must give up before the platform kills the request, otherwise the
 * failure is never recorded and the lecture looks stuck rather than failed.
 */
export function makeDeadline(budgetMs: number) {
  const at = Date.now() + budgetMs;
  return {
    remaining: () => Math.max(0, at - Date.now()),
    exceeded: () => Date.now() >= at,
    assertNotExceeded() {
      if (Date.now() >= at) {
        throw new AppError("stage_too_slow", "stage ran out of its time budget");
      }
    },
  };
}
