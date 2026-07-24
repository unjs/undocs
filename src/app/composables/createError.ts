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
}

interface CreateErrorInput extends AppError {
  [key: string]: any;
}

export function createError(input: string | CreateErrorInput): Error & AppError {
  const isString = typeof input === "string";
  const message = isString ? input : input.message || input.statusMessage || "Error";
  const err = new Error(message) as Error & AppError;
  if (!isString) {
    Object.assign(err, input);
    err.message = message;
  }
  return err;
}
