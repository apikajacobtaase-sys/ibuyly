 import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth/middleware", () => ({
  withAuth: (handler: any) => handler,
}));

import middleware from "../../proxy";

const handler = middleware as unknown as (
  request: any
) => Promise<Response> | Response;

function createRequest(path: string, role?: string) {
  const request = new NextRequest(`http://localhost${path}`);

  return Object.assign(request, {
    nextauth: {
      token: role ? { role } : null,
    },
  });
}

describe("Maintenance middleware access control", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects marketplace visitors during maintenance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ maintenanceMode: true })
      )
    );

    const response = await handler(createRequest("/products"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/maintenance");
  });

  it("blocks ADMIN from marketplace pages during maintenance", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({ maintenanceMode: true })
    )
  );

  const response = await handler(
    createRequest("/products", "ADMIN")
  );

  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toContain("/maintenance");
});

  it("blocks marketplace API requests with HTTP 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          maintenanceMode: true,
          message: "Scheduled maintenance",
        })
      )
    );

    const response = await handler(createRequest("/api/products"));

    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.code).toBe("MAINTENANCE_MODE");
  });

  it("allows ADMIN to access the admin panel during maintenance", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(createRequest("/admin", "ADMIN"));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

    it("blocks non-admin users from admin APIs during maintenance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ maintenanceMode: true })));

    const response = await handler(createRequest("/api/admin/settings", "CUSTOMER"));

    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.code).toBe("MAINTENANCE_MODE");
  });

  it("allows ADMIN to access admin APIs during maintenance", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(createRequest("/api/admin/settings", "ADMIN"));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN to access the admin panel during maintenance", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(
      createRequest("/admin", "SUPER_ADMIN")
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps Paystack webhooks accessible during maintenance", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(
      createRequest("/api/webhooks/paystack")
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});