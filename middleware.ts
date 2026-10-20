// src/middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Routes that require authentication
const protectedRoutes = [
  "/checkout",
  "/account",
  "/seller",
  "/admin",
];

// API routes that require authentication
const protectedApiRoutes = [
  "/api/user",
  "/api/cart", // Cart mutations require auth (guests use localStorage)
  "/api/admin",
  "/api/seller",
  "/api/payments",
];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // 1. Public routes — allow everyone (guests + authenticated)
    const publicPaths = [
      "/",
      "/products",
      "/cart",
      "/categories",
      "/login",
      "/register",
      "/auth",
      "/api/auth",
      "/api/products",
      "/api/locations",
      "/api/delivery",
      "/api/webhooks",
    ];

    const isPublicPath = publicPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );

    if (isPublicPath) {
      return NextResponse.next();
    }

    // 2. Check if route requires authentication
    const isProtectedRoute = protectedRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

    const isProtectedApi = protectedApiRoutes.some(
      (route) => pathname.startsWith(route)
    );

    if (isProtectedRoute || isProtectedApi) {
      // Not authenticated — redirect to login
      if (!token) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      // 3. Role-based access control
      const userRole = token.role as string;

      // Admin routes
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
          return NextResponse.redirect(new URL("/", req.url));
        }
      }

      // Seller routes
      if (pathname.startsWith("/seller") || pathname.startsWith("/api/seller")) {
        if (!["SELLER", "ADMIN", "SUPER_ADMIN"].includes(userRole)) {
          return NextResponse.redirect(new URL("/", req.url));
        }
      }

      // Account routes — any authenticated user
      if (pathname.startsWith("/account") || pathname.startsWith("/api/user")) {
        // All authenticated users can access their own account
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Allow all requests to reach the middleware — we handle auth checks manually
      authorized: () => true,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};