// route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_ORIGIN =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3333";

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const backendAuthUrl = `${trimTrailingSlash(BACKEND_ORIGIN)}/api/v1/auth`;
console.log("🔧 Backend Auth URL:", process.env.NEXT_PUBLIC_BACKEND_API_URL);


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mim?: string[] }> }
) {
  const mim = (await params)?.mim ?? [];
  const action = mim[0];

  switch (action) {
    case "google":
      return NextResponse.redirect(`${backendAuthUrl}/google`);
    case "facebook":
      return NextResponse.redirect(`${backendAuthUrl}/facebook`);
    case "github":
      return NextResponse.redirect(`${backendAuthUrl}/github`);
    case "me": {
      try {
        const accessToken = request.cookies.get("access_token")?.value;

        if (!accessToken) {
          return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        }

        // Direkt backend'e proxy yap, gereksiz server action çağrısı yapma
        const res = await fetch(`${BACKEND_ORIGIN}/user/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (res.status === 401) {
          return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        }

        if (!res.ok) {
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }

        const userData = await res.json();
        return NextResponse.json(userData);
      } catch (error) {
        console.error("Me endpoint error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }
    case "refresh": {
      try {
        console.log("🔄 Refresh GET endpoint called");
        const refreshToken = request.cookies.get("refresh_token")?.value;
        console.log("🔑 Refresh token from cookie:", refreshToken ? `${refreshToken.substring(0, 20)}...` : "None");
        
        if (!refreshToken) {
          console.log("❌ No refresh token found in cookies");
          return NextResponse.redirect(new URL("/auth/login", request.url));
        }

    console.log("📤 Calling backend refresh endpoint...", backendAuthUrl);
    const res = await fetch(`${backendAuthUrl}/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        console.log("📥 Backend response status:", res.status);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.log("❌ Backend error:", errorData);
          return NextResponse.redirect(new URL("/auth/login", request.url));
        }

        const data = await res.json();
        console.log("✅ Backend response data:", {
          has_access_token: !!data.access_token,
          has_refresh_token: !!data.refresh_token,
          access_token_length: data.access_token?.length || 0,
          refresh_token_length: data.refresh_token?.length || 0
        });
        
        const redirectTo = new URLSearchParams(request.nextUrl.searchParams).get('redirect') || '/dashboard';
        const response = NextResponse.redirect(new URL(redirectTo, request.url));

        if (data.access_token) {
          console.log("🍪 Setting access_token cookie, length:", data.access_token.length);
          response.cookies.set("access_token", data.access_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60,
          });
        }
        if (data.refresh_token) {
          console.log("🍪 Setting refresh_token cookie, length:", data.refresh_token.length);
          response.cookies.set("refresh_token", data.refresh_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        console.log("✅ Refresh completed successfully, redirecting to:", redirectTo);
        return response;
      } catch {
        return NextResponse.redirect(new URL("/auth/login", request.url));
      }
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mim?: string[] }> }
) {
  const mim = (await params)?.mim ?? [];
  const action = mim[0];
 

  switch (action) {
    case "login": {
      try {
        const body = await request.json();
        const { email, password } = body;

    const res = await fetch(`${backendAuthUrl}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          return NextResponse.json(
            { error: errorData.error || "Login failed" },
            { status: res.status }
          );
        }

        const data = await res.json();
        const response = NextResponse.redirect(new URL("/dashboard", request.url));

        if (data.access_token) {
          response.cookies.set("access_token", data.access_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60,
          });
        }
        if (data.refresh_token) {
          response.cookies.set("refresh_token", data.refresh_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        return response;
      } catch {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    case "register": {
      try {
        const body = await request.json();
        const { email, password, full_name } = body;

    const res = await fetch(`${backendAuthUrl}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, full_name }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          return NextResponse.json(
            { error: errorData.error || "Registration failed" },
            { status: res.status }
          );
        }

        const data = await res.json();
        const response = NextResponse.redirect(new URL("/", request.url));

        if (data.access_token) {
          response.cookies.set("access_token", data.access_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60,
          });
        }
        if (data.refresh_token) {
          response.cookies.set("refresh_token", data.refresh_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        return response;
      } catch {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    case "refresh": {
      try {
        console.log("🔄 Refresh endpoint called");
        const body = await request.json().catch(() => ({}));
        const refreshToken = body?.refresh_token || request.cookies.get("refresh_token")?.value;
        console.log(
          "🔑 Refresh token from body/cookie:",
          refreshToken ? `${refreshToken.substring(0, 20)}...` : "None"
        );
        
        if (!refreshToken) {
          console.log("❌ No refresh token found in cookies");
          return NextResponse.json(
            { 
              success: false, 
              error: "No refresh token", 
              code: "NO_REFRESH_TOKEN" 
            }, 
            { status: 401 }
          );
        }

    console.log("📤 Calling backend refresh endpoint...");
    const res = await fetch(`${backendAuthUrl}/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        console.log("📥 Backend response status:", res.status);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.log("❌ Backend error:", errorData);
          
          // Refresh token geçersiz ise cookie'leri temizle ve login'e yönlendir
          if (res.status === 401) {
            const response = NextResponse.redirect(new URL("/auth/login", request.url));
            response.cookies.delete("access_token");
            response.cookies.delete("refresh_token");
            return response;
          }
          
          return NextResponse.json(
            { 
              success: false, 
              error: errorData.error || "Refresh failed", 
              code: "REFRESH_FAILED" 
            }, 
            { status: res.status }
          );
        }

        const data = await res.json();
        console.log("✅ Backend response data:", {
          has_access_token: !!data.access_token,
          has_refresh_token: !!data.refresh_token,
          access_token_length: data.access_token?.length || 0,
          refresh_token_length: data.refresh_token?.length || 0
        });
        
        const response = NextResponse.json({ 
          success: true,
          message: "Tokens refreshed successfully"
        });

        if (data.access_token) {
          console.log("🍪 Setting access_token cookie, length:", data.access_token.length);
          response.cookies.set("access_token", data.access_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60,
          });
        }
        if (data.refresh_token) {
          console.log("🍪 Setting refresh_token cookie, length:", data.refresh_token.length);
          response.cookies.set("refresh_token", data.refresh_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        console.log("✅ Refresh completed successfully");
        return response;
      } catch (error) {
        console.error("❌ Refresh endpoint internal error:", error);
        return NextResponse.json(
          { 
            success: false, 
            error: "Internal server error", 
            code: "INTERNAL_ERROR" 
          },
          { status: 500 }
        );
      }
    }

    case "logout": {
      try {
        const body = await request.json().catch(() => ({}));
        const refreshToken = body?.refresh_token || request.cookies.get("refresh_token")?.value;

        if (refreshToken) {
          await fetch(`${backendAuthUrl}/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
        }

        const response = NextResponse.redirect(new URL("/", request.url));
        response.cookies.delete("access_token");
        response.cookies.delete("refresh_token");
        return response;
      } catch {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    case "logout-all": {
      try {
        const accessToken = request.cookies.get("access_token")?.value;

        if (!accessToken) {
          return NextResponse.json({ error: "No access token" }, { status: 401 });
        }

    const res = await fetch(`${backendAuthUrl}/logout-all`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const errorData = await res.json();
          return NextResponse.json(
            { error: errorData.error || "Logout all failed" },
            { status: res.status }
          );
        }

        const response = NextResponse.redirect(new URL("/", request.url));
        response.cookies.delete("access_token");
        response.cookies.delete("refresh_token");
        return response;
      } catch {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    case "callback": {
      try {
        const body = await request.json();
        const access_token = body?.access_token;
        const refresh_token = body?.refresh_token;
        const callbackUrl = body?.callbackUrl || "/dashboard";

        const response = NextResponse.redirect(new URL(callbackUrl, request.url));

        if (access_token) {
          response.cookies.set("access_token", access_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60,
          });
        }
        if (refresh_token) {
          response.cookies.set("refresh_token", refresh_token, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
          });
        }

        return response;
      } catch (err) {
        return NextResponse.json({ status: "error", message: String(err) }, { status: 500 });
      }
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
