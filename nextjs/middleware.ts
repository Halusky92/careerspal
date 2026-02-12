import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./lib/supabaseAdmin";

const adminPaths = ["/dashboard/admin"];
// Note: /post-a-job and /checkout are intentionally public.
// Auth is requested only at submission/payment time inside the UI.
const employerPaths = ["/dashboard/employer"];
const candidatePaths = ["/dashboard/candidate"];

const matchesPath = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export async function middleware(_request: NextRequest) {
  const request = _request;
  const { pathname } = request.nextUrl;
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
  matcher: ["/dashboard/:path*", "/account/:path*"],
};
