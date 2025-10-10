"use server";

import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.BACKEND_API_URL || "http://localhost:3333/api/v1";

export interface InvitationDetail {
  id: string;
  company_id: string;
  email: string;
  token: string;
  role_id: string;
  role_name: string;
  invited_by: string;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  company?: {
    id: string;
    name: string;
    logo?: string;
    email?: string;
    phone?: string;
  };
  inviter?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export async function getInvitationByToken(token: string): Promise<{
  success: boolean;
  data?: InvitationDetail;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_URL}/invitations/${token}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Davet bulunamadı",
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("Get invitation error:", error);
    return {
      success: false,
      error: "Davet bilgisi alınamadı",
    };
  }
}

export async function acceptInvitation(token: string, email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("access_token")?.value;

    if (!sessionToken) {
      return {
        success: false,
        error: "Daveti kabul etmek için giriş yapmalısınız",
      };
    }

    const response = await fetch(`${API_URL}/invitations/${token}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Davet kabul edilemedi",
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || "Davet başarıyla kabul edildi",
    };
  } catch (error) {
    console.error("Accept invitation error:", error);
    return {
      success: false,
      error: "Davet kabul edilirken bir hata oluştu",
    };
  }
}

export async function rejectInvitation(token: string, email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_URL}/invitations/${token}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Davet reddedilemedi",
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || "Davet reddedildi",
    };
  } catch (error) {
    console.error("Reject invitation error:", error);
    return {
      success: false,
      error: "Davet reddedilirken bir hata oluştu",
    };
  }
}
