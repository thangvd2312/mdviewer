import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthUser } from "./auth.guard";

/**
 * For pages anyone may open: sets `req.user` when a valid token is sent, and lets requests without
 * a token through as anonymous. A token that is sent but invalid (e.g. expired) is ignored for
 * reading, but refused for writes — otherwise a signed-in reader whose session ran out would
 * silently post as a guest instead of being asked to sign in again.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const [type, token] = (header ?? "").split(" ");
    const write = req.method !== "GET" && req.method !== "HEAD";
    // Any credential that is sent must be a complete bearer token, or a write is refused.
    if (header !== undefined && (type !== "Bearer" || !token) && write) {
      throw new UnauthorizedException(
        "Your session has expired. Sign in again to continue.",
      );
    }
    if (type === "Bearer" && token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
        req.user = { id: payload.sub } satisfies AuthUser;
      } catch {
        req.user = undefined;
        if (write) {
          throw new UnauthorizedException(
            "Your session has expired. Sign in again to continue.",
          );
        }
      }
    }
    return true;
  }
}
