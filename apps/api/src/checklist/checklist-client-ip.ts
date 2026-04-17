import { Request } from "express";

export function clientIpFromRequest(req: Request | undefined): string | null {
  if (!req) return null;
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    return first || null;
  }
  const rip = req.headers?.["x-real-ip"];
  if (typeof rip === "string" && rip.trim()) return rip.trim();
  if (typeof req.ip === "string" && req.ip.length > 0) return req.ip;
  return null;
}
