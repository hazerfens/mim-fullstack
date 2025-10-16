import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getInvitationByToken } from "@/features/actions/invitation-action";
import InvitationAcceptanceClient from "@/features/components/invitation/invitation-acceptance-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitationPage({ params }: PageProps) {
  const { token } = await params;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("access_token")?.value;

  const result = await getInvitationByToken(token);

  if (!result.success || !result.data) {
    redirect("/dashboard?error=invalid_invitation");
  }

  const invitation = result.data;

  // Check if invitation is expired
  const expiresAt = new Date(invitation.expires_at);
  const isExpired = expiresAt < new Date();

  if (isExpired || invitation.status !== "pending") {
    redirect("/dashboard?error=invitation_expired");
  }

  // If user is not authenticated, decide whether to redirect to login or register
  if (!sessionToken) {
    // If the invited user already exists, send them to login; otherwise, to register
    // We'll call a lightweight endpoint to check if the user exists using the invitation email
    const userCheck = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.BACKEND_API_URL || "http://localhost:3333/api/v1"}/auth/check-email?email=${encodeURIComponent(invitation.email)}`);
    if (userCheck.ok) {
      const userData = await userCheck.json();
      const exists = userData.exists;
      if (exists) {
        redirect(`/auth/login?invitation_token=${token}&email=${encodeURIComponent(invitation.email)}`);
      } else {
        redirect(`/auth/register?invitation_token=${token}&email=${encodeURIComponent(invitation.email)}`);
      }
    } else {
      // Fallback to register
      redirect(`/auth/register?invitation_token=${token}&email=${encodeURIComponent(invitation.email)}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <InvitationAcceptanceClient invitation={invitation} token={token} />
    </div>
  );
}
