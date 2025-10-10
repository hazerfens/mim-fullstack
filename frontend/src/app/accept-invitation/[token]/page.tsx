import { redirect } from "next/navigation";
import { getInvitationByToken } from "@/features/actions/invitation-action";
import InvitationAcceptanceClient from "@/features/components/invitation/invitation-acceptance-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitationPage({ params }: PageProps) {
  const { token } = await params;

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <InvitationAcceptanceClient invitation={invitation} token={token} />
    </div>
  );
}
