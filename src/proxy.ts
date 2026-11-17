 import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const protectedRoutes = ["/checkout", "/account", "/seller", "/admin"];

const protectedApiRoutes = [
  "/api/user",
  "/api/admin",
  "/api/seller",
  "/api/payments",
];

const maintenanceExemptPaths = [
  "/maintenance",
  "/login",
  "/register",
  "/auth",
  "/api/auth",
  "/api/webhooks/paystack",
  "/api/payments/verify",
  "/api/maintenance-status",
];

function matchesPath(pathname: string, paths: string[]) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const userRole = typeof token?.role === "string" ? token.role : "";

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
    const isAdminArea = matchesPath(pathname, ["/admin", "/api/admin"]);
    const canBypassMaintenance = isAdmin && isAdminArea;

    // Maintenance checks must not interfere with authentication,
    // payment webhooks, the maintenance page or administrator APIs.
    const isMaintenanceExempt = matchesPath(
      pathname,
      maintenanceExemptPaths
    );

   if (!isMaintenanceExempt && !canBypassMaintenance) {
      try {
        const statusUrl = new URL("/api/maintenance-status", req.url);

        const response = await fetch(statusUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          const status = await response.json();

          if (status.maintenanceMode === true) {
            if (pathname.startsWith("/api/")) {
              return NextResponse.json(
                {
                  error: "Marketplace is temporarily unavailable.",
                  code: "MAINTENANCE_MODE",
                  message: status.message ?? null,
                  expectedBackAt: status.expectedBackAt ?? null,
                },
                {
                  status: 503,
                  headers: { "Retry-After": "300" },
                }
              );
            }

            const maintenanceUrl = new URL("/maintenance", req.url);
            return NextResponse.redirect(maintenanceUrl);
          }
        }
      } catch (error) {
        // Fail open if the maintenance-status service is unavailable.
        console.error("Maintenance middleware check failed:", error);
      }
    }

    // Public routes — guests and authenticated users.
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
      "/api/webhooks/paystack",
      "/api/maintenance-status",
    ];

    if (matchesPath(pathname, publicPaths)) {
      return NextResponse.next();
    }

    const isProtectedRoute = matchesPath(pathname, protectedRoutes);
    const isProtectedApi = matchesPath(pathname, protectedApiRoutes);

    if (isProtectedRoute || isProtectedApi) {
      if (!token) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);

        return NextResponse.redirect(loginUrl);
      }

      // Administrator access.
      if (matchesPath(pathname, ["/admin", "/api/admin"])) {
        if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
          return NextResponse.redirect(new URL("/", req.url));
        }
      }

      // Seller access.
      if (matchesPath(pathname, ["/seller", "/api/seller"])) {
        if (
          ![
            "SELLER_OWNER",
            "SELLER_STAFF",
            "ADMIN",
            "SUPER_ADMIN",
          ].includes(userRole)
        ) {
          return NextResponse.redirect(new URL("/", req.url));
        }
      }

      // Account routes are available to authenticated users.
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};