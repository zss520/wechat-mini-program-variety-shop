import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { fail, HttpError } from "./http";

export type Role = "admin" | "user";

export interface AuthPayload {
  id: number;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpires });
}

export function readToken(req: Request): AuthPayload | null {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    return jwt.verify(m[1], config.jwtSecret) as AuthPayload;
  } catch {
    return null;
  }
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = readToken(req);
    if (!auth) return fail(res, 401, "未登录");
    if (auth.role !== role) return fail(res, 403, "无权限");
    req.auth = auth;
    next();
  };
}

export function optionalUser(req: Request, _res: Response, next: NextFunction) {
  const auth = readToken(req);
  if (auth && auth.role === "user") req.auth = auth;
  next();
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return fail(res, err.status, err.message, err.code);
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return fail(res, 500, "服务器异常");
}
