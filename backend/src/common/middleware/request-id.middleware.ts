import { randomUUID } from "node:crypto";

import { NextFunction, Request, Response } from "express";

export interface RequestWithId extends Request {
  requestId?: string;
}

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

export function requestIdMiddleware(request: RequestWithId, response: Response, next: NextFunction): void {
  const requestIdHeader = request.header("x-request-id");
  const requestId = requestIdHeader && REQUEST_ID_PATTERN.test(requestIdHeader) ? requestIdHeader : randomUUID();

  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);
  next();
}
