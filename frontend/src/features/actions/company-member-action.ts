"use server";

import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.BACKEND_API_URL || "http://localhost:3333/api/v1";

export interface CompanyMember {
  id: string;
  user_id: string;
  company_id: string;
  role_id: string;
  is_owner: boolean;
  is_active: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    full_name?: string;
    image_url?: string;
  };
  // Indicates whether the referenced user record exists in the users table
  user_exists?: boolean;
  role?: {
    id: string;
    name: string;
    description?: string;
  };
}

export interface PendingInvitation {
  id: string;
  company_id: string;
  email: string;
  token: string;
  role_id?: string | null;
  role_name: string;
  invited_by: string;
  status: string;
  expires_at: string;
  created_at: string;
  inviter?: {
    id: string;
    email: string;
    full_name?: string;
    image_url?: string;
  };
  company?: {
    id: string;
    name?: string;
    adi?: string;
  };
  role?: {
    id: string;
    name: string;
    description?: string;
  };
}

export async function getCompanyMembers(companyId: string): Promise<{
  success: boolean;
  data?: CompanyMember[];
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("access_token")?.value;

    if (!sessionToken) {
      return {
        success: false,
        error: "Oturum bulunamadı",
      };
    }

    const response = await fetch(`${API_URL}/company/${companyId}/members`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Üyeler getirilemedi",
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.members || [],
    };
  } catch (error) {
    console.error("Get company members error:", error);
    return {
      success: false,
      error: "Üyeler getirilirken bir hata oluştu",
    };
  }
}

export async function getCompanyInvitations(companyId: string): Promise<{
  success: boolean;
  data?: PendingInvitation[];
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("access_token")?.value;

    if (!sessionToken) {
      return {
        success: false,
        error: "Oturum bulunamadı",
      };
    }

    const response = await fetch(`${API_URL}/company/${companyId}/invitations`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Davetler getirilemedi",
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.invitations || [],
    };
  } catch (error) {
    console.error("Get company invitations error:", error);
    return {
      success: false,
      error: "Davetler getirilirken bir hata oluştu",
    };
  }
}

export async function createCompanyInvitation(
  companyId: string,
  email: string,
  roleName: string
): Promise<{
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
        error: "Oturum bulunamadı",
      };
    }

    const response = await fetch(`${API_URL}/company/${companyId}/invitations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ email, role_name: roleName }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Davet gönderilemedi",
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || "Davet başarıyla gönderildi",
    };
  } catch (error) {
    console.error("Create invitation error:", error);
    return {
      success: false,
      error: "Davet gönderilirken bir hata oluştu",
    };
  }
}

export async function removeMember(
  companyId: string,
  memberId: string
): Promise<{
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
        error: "Oturum bulunamadı",
      };
    }

    const response = await fetch(`${API_URL}/company/${companyId}/members/${memberId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Üye çıkarılamadı",
      };
    }

    return {
      success: true,
      message: "Üye başarıyla çıkarıldı",
    };
  } catch (error) {
    console.error("Remove member error:", error);
    return {
      success: false,
      error: "Üye çıkarılırken bir hata oluştu",
    };
  }
}

export async function cancelInvitation(
  companyId: string,
  invitationId: string
): Promise<{
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
        error: "Oturum bulunamadı",
      };
    }

    const response = await fetch(
      `${API_URL}/company/${companyId}/invitations/${invitationId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || "Davet iptal edilemedi",
      };
    }

    return {
      success: true,
      message: "Davet iptal edildi",
    };
  } catch (error) {
    console.error("Cancel invitation error:", error);
    return {
      success: false,
      error: "Davet iptal edilirken bir hata oluştu",
    };
  }
}
