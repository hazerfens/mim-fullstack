"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, User, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InlineAlert from '@/components/ui/inline-alert';
import { acceptInvitation, rejectInvitation, type InvitationDetail } from "@/features/actions/invitation-action";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface InvitationAcceptanceClientProps {
  invitation: InvitationDetail;
  token: string;
}

export default function InvitationAcceptanceClient({
  invitation,
  token,
}: InvitationAcceptanceClientProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);

    const result = await acceptInvitation(token, invitation.email);

    if (result.success) {
      // Redirect to dashboard after successful acceptance
      router.push("/dashboard?invitation_accepted=true");
    } else {
      setError(result.error || "Davet kabul edilemedi");
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    setError(null);

    const result = await rejectInvitation(token, invitation.email);

    if (result.success) {
      // Redirect to login or home page after rejection
      router.push("/?invitation_rejected=true");
    } else {
      setError(result.error || "Davet reddedilemedi");
      setIsRejecting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "super_admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "admin":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "company_owner":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      super_admin: "Süper Admin",
      admin: "Yönetici",
      company_owner: "Şirket Sahibi",
      manager: "Müdür",
      user: "Kullanıcı",
    };
    return roleMap[role.toLowerCase()] || role;
  };

  return (
    <Card className="w-full max-w-2xl shadow-2xl border-2">
      <CardHeader className="space-y-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Şirket Daveti
        </CardTitle>
        <CardDescription className="text-blue-50">
          Bir şirkete katılmak için davet edildiniz
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Company Info */}
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border">
          {invitation.company?.logo ? (
            <Avatar className="h-16 w-16">
              <AvatarImage src={invitation.company.logo} alt={invitation.company?.name || ""} />
              <AvatarFallback>
                <Building2 className="h-8 w-8 text-gray-400" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">
              {invitation.company?.name || "Bilinmeyen Şirket"}
            </h3>
            {invitation.company?.email && (
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                <Mail className="h-3 w-3" />
                {invitation.company.email}
              </p>
            )}
          </div>
        </div>

        {/* Role Badge */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Size atanan rol:</p>
          <Badge variant="outline" className={`text-sm px-3 py-1 ${getRoleBadgeColor(invitation.role_name)}`}>
            {getRoleDisplayName(invitation.role_name)}
          </Badge>
        </div>

        {/* Inviter Info */}
        {invitation.inviter && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <User className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {invitation.inviter.full_name || "Bilinmeyen Kullanıcı"}
              </p>
              <p className="text-xs text-gray-600">{invitation.inviter.email}</p>
            </div>
            <span className="ml-auto text-xs text-gray-500">tarafından davet edildiniz</span>
          </div>
        )}

        {/* Invitation Email */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
          <Mail className="h-5 w-5 text-gray-600" />
          <div>
            <p className="text-sm font-medium text-gray-700">Davet e-postası:</p>
            <p className="text-sm text-gray-900">{invitation.email}</p>
          </div>
        </div>

        {/* Expiration */}
        <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <Clock className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-gray-700">Son geçerlilik tarihi:</p>
            <p className="text-sm text-gray-900">{formatDate(invitation.expires_at)}</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <InlineAlert variant="destructive" description={error} />
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleAccept}
            disabled={isAccepting || isRejecting}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            {isAccepting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Kabul Ediliyor...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Daveti Kabul Et
              </>
            )}
          </Button>

          <Button
            onClick={handleReject}
            disabled={isAccepting || isRejecting}
            variant="outline"
            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
            size="lg"
          >
            {isRejecting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Reddediliyor...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-5 w-5" />
                Daveti Reddet
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-gray-500 pt-2">
          Bu daveti kabul ederek şirketin bir üyesi olacaksınız
        </p>
      </CardContent>
    </Card>
  );
}
