import { Middleware } from '../core';
import { BaseError } from '../errors';

export type BlacklistItem = {
  alternativeMessage: string;
  statusCode: number | undefined;
  alternativeStatusCode?: number;
};

interface ErrorLogger {
  error(...args: any[]): any;

  [log: string]: any;
}

export interface HttpErrorHandlerOptions {
  logError?: (message: any) => any;
  logger?: ErrorLogger;
  /**
   * List of errors with status codes, where error message should be obfuscated
   * @default [
   *  { message: 'Internal Server Error', statusCode: 500 },
   *  { message: 'Forbidden', statusCode: 403 },
   *  { message: 'Unauthorized', statusCode: 401 },
   *  { message: 'InternalServerError', statusCode: undefined },
   *  ]
   */
  blacklist?: BlacklistItem[];
  safeBaseError?: any;
}

type ResolvedHttpErrorHandlerOptions = Required<
  Pick<HttpErrorHandlerOptions, 'blacklist' | 'safeBaseError'>
>;

const unknownError = {
  statusCode: undefined,
  alternativeMessage: 'InternalServerError',
  alternativeStatusCode: 500,
};
const internalServerError = { statusCode: 500, alternativeMessage: 'InternalServerError' };
const forbiddenError = { statusCode: 403, alternativeMessage: 'Forbidden' };
const unauthorizedError = { statusCode: 401, alternativeMessage: 'Unauthorized' };

const defaultOptions: ResolvedHttpErrorHandlerOptions = {
  blacklist: [internalServerError, forbiddenError, unauthorizedError, unknownError],
  safeBaseError: BaseError,
};

type HttpErrorHandlerRequiredEvents = {
  path: string;
  httpMethod: string;
  deps?: { logger?: ErrorLogger };
};

export const registerHttpErrorHandler = <T extends HttpErrorHandlerRequiredEvents>(
  options: HttpErrorHandlerOptions = {},
): Middleware<T, T> => handler => async (event, ...args) =>
  handler(event, ...args).catch(errorOrErrorAndResponse => {
    const [err, response] = Array.isArray(errorOrErrorAndResponse)
      ? errorOrErrorAndResponse
      : [errorOrErrorAndResponse];
    const resolvedOptions = { ...defaultOptions, ...options };
    const logError = getLogError(event, resolvedOptions);
    if (err) {
      logError(err);
    }
    const { statusCode, message } = getSafeResponse(resolvedOptions, err);
    return {
      ...response,
      statusCode,
      headers: {
        ...response?.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: message,
      }),
    };
  });

export const getLogError = (
  event: HttpErrorHandlerRequiredEvents,
  options: HttpErrorHandlerOptions,
) => {
  const logger = event.deps?.logger ?? options.logger;
  return logger ? (...args: any[]) => logger.error(...args) : options.logError ?? (() => null);
};

export const getSafeResponse = (options: ResolvedHttpErrorHandlerOptions, error?: any) => {
  const isSafeErrorInstance = error instanceof options.safeBaseError;
  if (!isSafeErrorInstance) {
    return {
      message: internalServerError.alternativeMessage,
      statusCode: internalServerError.statusCode,
    };
  }
  const blacklistItem = options.blacklist.find(
    ({ statusCode }) => error?.statusCode === statusCode,
  );
  if (blacklistItem) {
    return {
      message: blacklistItem.alternativeMessage,
      statusCode: blacklistItem.alternativeStatusCode ?? blacklistItem.statusCode,
    };
  }
  return error;
};
