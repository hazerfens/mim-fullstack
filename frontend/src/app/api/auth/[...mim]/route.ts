// route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3333";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mim?: string[] }> }
) {
  const mim = (await params)?.mim ?? [];
  const action = mim[0];

  switch (action) {
    case "google":
      return NextResponse.redirect(`${BACKEND_URL}/auth/google`);
    case "facebook":
      return NextResponse.redirect(`${BACKEND_URL}/auth/facebook`);
    case "github":
      return NextResponse.redirect(`${BACKEND_URL}/auth/github`);
    case "me": {
      try {
        const accessToken = request.cookies.get("access_token")?.value;
        if (!accessToken) {
          return NextResponse.json({ error: "No access token" }, { status: 401 });
        }
        const res = await fetch(`${BACKEND_URL}/user/me`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          return NextResponse.json(await res.json(), { status: res.status });
        }
        const data = await res.json();
        return NextResponse.json(data);
      } catch {
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

        console.log("📤 Calling backend refresh endpoint...");
        const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
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

        const res = await fetch(`${BACKEND_URL}/auth/login`, {
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

        const res = await fetch(`${BACKEND_URL}/auth/register`, {
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
        const refreshToken = request.cookies.get("refresh_token")?.value;
        console.log("🔑 Refresh token from cookie:", refreshToken ? `${refreshToken.substring(0, 20)}...` : "None");
        
        if (!refreshToken) {
          console.log("❌ No refresh token found in cookies");
          return NextResponse.json({ error: "No refresh token" }, { status: 401 });
        }

        console.log("📤 Calling backend refresh endpoint...");
        const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        console.log("📥 Backend response status:", res.status);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.log("❌ Backend error:", errorData);
          return NextResponse.json(
            { error: errorData.error || "Refresh failed" },
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
        
        const response = NextResponse.json({ success: true });

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
      } catch {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    case "logout": {
      try {
        const accessToken = request.cookies.get("access_token")?.value;

        // Optionally call backend logout
        if (accessToken) {
          await fetch(`${BACKEND_URL}/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: accessToken }),
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

        const res = await fetch(`${BACKEND_URL}/auth/logout-all`, {
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

