import { parse } from 'cookie';
import { APIGatewayEvent } from 'aws-lambda';

import { Middleware } from '../core';

export const parseCookie = <T extends APIGatewayEvent>(): Middleware<
  T,
  T & { cookie: object }
> => handler => (event: T, ...args) =>
  handler({ ...event, cookie: event.headers?.Cookie ? parse(event.headers.Cookie) : {} }, ...args);