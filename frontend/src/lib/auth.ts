import { User } from "@/types/user/user";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
export async function getUserProfile() {
  console.log("🔍 getUserProfile() called");
  try {
    const cookieStore = await cookies();
    // Ensure we have a valid access token; try refresh if missing
  let accessToken: string | null = cookieStore.get("access_token")?.value ?? null;
    const refreshToken = cookieStore.get("refresh_token")?.value;
    
    console.log("🍪 Current cookies - access_token:", accessToken ? "exists" : "missing", "refresh_token:", refreshToken ? "exists" : "missing");

    async function tryRefresh(): Promise<string | null> {
      console.log("🔄 tryRefresh() called - attempting refresh via Next.js API route");
      if (!refreshToken) return null;
      try {
        // Use Next.js API route for proper cookie management
        const r = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        console.log("📥 API route response status:", r.status);
        if (!r.ok) return null;
        const body = await r.json();
        console.log("📄 API route response body:", body);
        if (body.success) {
          // Cookies are set by the API route via response headers
          // Get the new access token from the updated cookies
          const updatedCookieStore = await cookies();
          return updatedCookieStore.get("access_token")?.value || null;
        }
        return null;
      } catch {
        return null;
      }
    }

    if (!accessToken) {
      accessToken = await tryRefresh();
      if (!accessToken) return null;
    }

    // Perform profile request; if unauthorized, attempt refresh and retry once
    let res = await fetch(`${API_URL}/api/auth/me`, {
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
      res = await fetch(`${API_URL}/api/auth/me`, {
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
  console.log("🔍 getServerSession() called");
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  console.log("🍪 getServerSession cookies - access_token:", accessToken ? "exists" : "missing");
  if (!accessToken) return null;
  try {
    const decoded = jwt.decode(accessToken);
    if (!decoded || typeof decoded !== "object") return null;
    return decoded as User;
  } catch {
    return null;
  }
}

// Logout işlemi
export async function logoutUser() {
  try {
    console.log("🔄 logoutUser() called - calling API route");
    const res = await fetch(`${API_URL}/api/auth/logout`, {
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