import type { Request } from "express";

export interface ClientInfo {
  ip: string;
  userAgent: string;
  /** Short, human-readable device, e.g. "iPhone · Safari". */
  device: string;
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * The visitor's IP and device. In production the app listens on 127.0.0.1 behind cloudflared,
 * so the real address comes from Cloudflare's CF-Connecting-IP header — trusted only when the
 * request arrives from this machine (anything else can't have come through the tunnel).
 */
export function clientInfo(req: Request): ClientInfo {
  const remote = req.socket.remoteAddress ?? "";
  let ip = remote;
  if (LOOPBACK.has(remote)) {
    const forwarded =
      header(req, "cf-connecting-ip") ??
      header(req, "x-forwarded-for")?.split(",")[0];
    if (forwarded?.trim()) ip = forwarded.trim();
  }
  ip = ip.replace(/^::ffff:/, "").slice(0, 45) || "unknown";
  const userAgent = (header(req, "user-agent") ?? "").slice(0, 400);
  return { ip, userAgent, device: describeDevice(userAgent) };
}

const header = (req: Request, name: string) => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

export function describeDevice(ua: string): string {
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? "Android phone"
          : "Android tablet"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "Other";
  const browser = /Zalo/i.test(ua)
    ? "Zalo"
    : /FBAN|FBAV|FB_IAB/.test(ua)
      ? "Facebook"
      : /Edg\//.test(ua)
        ? "Edge"
        : /OPR\/|Opera/.test(ua)
          ? "Opera"
          : /SamsungBrowser/.test(ua)
            ? "Samsung Internet"
            : /CriOS|Chrome\//.test(ua)
              ? "Chrome"
              : /FxiOS|Firefox\//.test(ua)
                ? "Firefox"
                : /Safari\//.test(ua)
                  ? "Safari"
                  : /bot|crawl|spider|curl|wget|python|httpclient/i.test(ua)
                    ? "Bot/script"
                    : "Browser";
  return `${os} · ${browser}`;
}
