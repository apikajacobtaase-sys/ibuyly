 export function getAppUrl(): string {
  const configuredUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "");

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Application URL is not configured.");
    }

    return "http://localhost:3000";
  }

  const url = new URL(configuredUrl);

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Production application URL must use HTTPS.");
  }

  return url.origin;
}