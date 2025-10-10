"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DashboardNotifications() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const invitationAccepted = searchParams.get("invitation_accepted");
  const invitationRejected = searchParams.get("invitation_rejected");
  const error = searchParams.get("error");

  useEffect(() => {
    // Clear query params after 5 seconds
    if (invitationAccepted || invitationRejected || error) {
      const timeout = setTimeout(() => {
        router.replace("/dashboard");
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [invitationAccepted, invitationRejected, error, router]);

  if (invitationAccepted) {
    return (
      <Alert className="mb-6 border-green-200 bg-green-50">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-green-900">Davet Kabul Edildi!</AlertTitle>
        <AlertDescription className="text-green-800">
          Şirket davetini başarıyla kabul ettiniz. Artık şirket üyesisiniz.
        </AlertDescription>
      </Alert>
    );
  }

  if (invitationRejected) {
    return (
      <Alert className="mb-6 border-gray-200 bg-gray-50">
        <XCircle className="h-5 w-5 text-gray-600" />
        <AlertTitle className="text-gray-900">Davet Reddedildi</AlertTitle>
        <AlertDescription className="text-gray-800">
          Şirket davetini reddettiniz.
        </AlertDescription>
      </Alert>
    );
  }

  if (error === "invalid_invitation") {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Geçersiz Davet</AlertTitle>
        <AlertDescription>
          Bu davet geçersiz veya bulunamadı.
        </AlertDescription>
      </Alert>
    );
  }

  if (error === "invitation_expired") {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Süresi Dolmuş Davet</AlertTitle>
        <AlertDescription>
          Bu davet süresi dolmuş veya zaten kullanılmış.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
