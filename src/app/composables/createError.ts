/**
 * `createError` / `AppError` — build an Error carrying
 * statusCode/statusMessage/fatal/data props. Pages throw these for the 404 case;
 * `main.ts`'s root error boundary reads `fatal`/`statusCode` to swap in the
 * error page.
 */
export interface AppError<DataT = unknown> {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
  fatal?: boolean;
  data?: DataT;
  /**
   * Go here instead of rendering the error page: a 302 from `entry-server.ts`,
   * a `router.replace` from `main.ts`. The current query (and, client-side,
   * hash) carry over.
   */
  redirect?: string;
}

/**
 * Where an `AppError.redirect` lands: the current `query` spliced in before the
 * target's own `#hash`, or the current `hash` when the target has none.
 */
export function redirectLocation(target: string, query: string, hash = ""): string {
  const i = target.indexOf("#");
  return i === -1 ? target + query + hash : target.slice(0, i) + query + target.slice(i);
}

interface CreateErrorInput<DataT> extends AppError<DataT> {
  [key: string]: any;
}

export function createError<DataT = unknown>(
  input: string | CreateErrorInput<DataT>,
): Error & AppError<DataT> {
  const isString = typeof input === "string";
  const message = isString ? input : input.message || input.statusMessage || "Error";
  const err = new Error(message) as Error & AppError<DataT>;
  if (!isString) {
    Object.assign(err, input);
    err.message = message;
  }
  return err;
}
