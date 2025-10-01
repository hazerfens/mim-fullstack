import { User } from "@/types/user/user";
import { cookies } from "next/headers";
import { getCurrentUserAction } from "@/features/actions/auth-action";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const internalAuthBase = `${trimTrailingSlash(APP_ORIGIN)}/api/auth`;
const internalRefreshUrl = `${internalAuthBase}/refresh`;
const internalMeUrl = `${internalAuthBase}/me`;
const internalLogoutUrl = `${internalAuthBase}/logout`;

export async function getUserProfile() {
  console.log("🔍 getUserProfile() called");
  try {
    const cookieStore = await cookies();
    // Ensure we have a valid access token; try refresh if missing
    let accessToken: string | null = cookieStore.get("access_token")?.value ?? null;
    let refreshToken = cookieStore.get("refresh_token")?.value ?? null;

    console.log(
      "🍪 Current cookies - access_token:",
      accessToken ? "exists" : "missing",
      "refresh_token:",
      refreshToken ? "exists" : "missing"
    );

    async function tryRefresh(): Promise<string | null> {
      console.log("🔄 tryRefresh() called - attempting refresh via Next.js API route");
      const latestCookies = await cookies();
      const tokenToUse = latestCookies.get("refresh_token")?.value ?? refreshToken;
      if (!tokenToUse) return null;

      try {
        const response = await fetch(internalRefreshUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: tokenToUse }),
          cache: "no-store",
        });

        console.log("📥 API route response status:", response.status);
        if (!response.ok) return null;

        const body = await response.json();
        console.log("📄 API route response body:", body);
        if (!body.success) {
          return null;
        }

        const updatedCookieStore = await cookies();
        refreshToken = updatedCookieStore.get("refresh_token")?.value ?? refreshToken;
        return updatedCookieStore.get("access_token")?.value || null;
      } catch (error) {
        console.error("❌ Refresh attempt failed:", error);
        return null;
      }
    }

    if (!accessToken) {
      accessToken = await tryRefresh();
      if (!accessToken) return null;
    }

    // Perform profile request; if unauthorized, attempt refresh and retry once
    let res = await fetch(internalMeUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (res.status === 401) {
      const newAccess = await tryRefresh();
      if (!newAccess) return null;
      res = await fetch(internalMeUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newAccess}`,
        },
        cache: "no-store",
      });
    }

    if (!res.ok) {
      console.error("Profil alınamadı:", res.status);
      return null;
    }

    const data = await res.json();
    return data as User;
  } catch (error) {
    console.error("Kullanıcı profil sorgusu hatası:", error);
    return null;
  }
}

export async function getServerSession() {
  const { status, user } = await getCurrentUserAction();
  return status === "success" ? (user as User) : null;
}

// Logout işlemi
export async function logoutUser() {
  try {
    console.log("🔄 logoutUser() called - calling API route");
    const res = await fetch(internalLogoutUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Logout API call failed:", res.status);
      return { status: "error", message: "Logout failed", statusCode: res.status };
    }

    return { status: "success", message: "Çıkış başarılı." };
  } catch (error) {
    console.error("Logout hatası:", error);
    return { status: "error", message: "Bir hata oluştu.", statusCode: 500 };
  }
}