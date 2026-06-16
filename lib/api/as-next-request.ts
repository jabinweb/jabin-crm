import { NextRequest } from "next/server"

/** Route handlers typed as `Request` can be wrapped for tenant helpers that expect `NextRequest`. */
export function asNextRequest(req: Request): NextRequest {
  return req instanceof NextRequest
    ? req
    : new NextRequest(req.url, { headers: req.headers, method: req.method })
}
