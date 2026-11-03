import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Public writes must come from our own pages. Guests have no credentials, so without this another
 * website could make its visitors' browsers post comments here (an auto-submitted HTML form), with
 * those visitors' IPs. Two checks stop that:
 *  - a request with a body must be JSON — HTML forms can't send it, and a cross-site script can
 *    only do so after a CORS preflight, which our CORS settings refuse for other origins;
 *  - when the browser says where the request comes from (`Origin`), it must be our site.
 *    `Origin: null` (sandboxed frames, some redirects) is refused too.
 * Reads are unaffected.
 */
@Injectable()
export class SameSiteWriteGuard implements CanActivate {
  private readonly allowed: Set<string>;
  private readonly allowLocalhost: boolean;

  constructor(config: ConfigService) {
    const origins = [
      config.get<string>("FRONTEND_URL", "http://localhost:5173"),
      ...(config.get<string>("ALLOWED_ORIGINS") ?? "").split(","),
    ];
    this.allowed = new Set(
      origins.map((o) => o.trim().replace(/\/$/, "")).filter(Boolean),
    );
    // Development: Vite may run on any localhost port.
    this.allowLocalhost = config.get("NODE_ENV") !== "production";
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (
      req.method === "GET" ||
      req.method === "HEAD" ||
      req.method === "OPTIONS"
    )
      return true;

    const origin = req.headers.origin;
    if (origin !== undefined && !this.isAllowed(origin)) {
      throw new ForbiddenException("This request didn’t come from viewmd.");
    }
    const hasBody =
      Number(req.headers["content-length"] ?? 0) > 0 ||
      req.headers["transfer-encoding"] !== undefined;
    if (hasBody && !req.is("application/json")) {
      throw new UnsupportedMediaTypeException("Send JSON.");
    }
    return true;
  }

  private isAllowed(origin: string) {
    if (this.allowed.has(origin)) return true;
    return (
      this.allowLocalhost &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    );
  }
}
