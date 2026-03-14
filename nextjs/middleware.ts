import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./lib/supabaseAdmin";

const adminPaths = ["/dashboard/admin"];
// Note: /post-a-job and /checkout are intentionally public.
// Auth is requested only at submission/payment time inside the UI.
const employerPaths = ["/dashboard/employer"];
const candidatePaths = ["/dashboard/candidate"];
const protectedPaths = ["/dashboard", "/account"];

const matchesPath = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export async function middleware(_request: NextRequest) {
  const request = _request;
  const { pathname } = request.nextUrl;
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0] || "";

  // Canonicalize apex -> www, but ONLY for top-level document navigations.
  // Redirecting RSC/flight fetches cross-origin causes "Server Components render" errors in the browser.
  if (host === "careerspal.com") {
    const accept = (request.headers.get("accept") || "").toLowerCase();
    const secFetchDest = (request.headers.get("sec-fetch-dest") || "").toLowerCase();
    const isRsc =
      request.headers.get("rsc") === "1" || accept.includes("text/x-component") || request.nextUrl.searchParams.has("_rsc");
    const isDocument = secFetchDest === "document" || accept.includes("text/html");

    if (isDocument && !isRsc) {
      const url = request.nextUrl.clone();
      url.hostname = "www.careerspal.com";
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }
  }

  // Only enforce auth on protected areas. Public pages should never require a token.
  if (!matchesPath(pathname, protectedPaths)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("cp_access_token")?.value;

  if (!token) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (!supabaseAdmin) {
    return NextResponse.next();
  }

  const { data } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user;
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const role = profile.role || "candidate";
  if (matchesPath(pathname, adminPaths) && role !== "admin") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard/candidate";
    return NextResponse.redirect(redirectUrl);
  }

  if (matchesPath(pathname, employerPaths) && role !== "employer" && role !== "admin") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard/candidate";
    return NextResponse.redirect(redirectUrl);
  }

  if (matchesPath(pathname, candidatePaths) && role === "employer") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard/employer";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all pages + APIs, but skip Next assets.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|icon|logo.svg).*)",
  ],
};
