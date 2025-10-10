import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ShieldAlert } from "lucide-react";
import { UnauthorizedActions } from "@/features/components/dashboard/unauthorized-actions";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Building2 className="h-16 w-16 text-muted-foreground" />
              <ShieldAlert className="h-8 w-8 text-destructive absolute -bottom-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl">Yetkisiz Erişim</CardTitle>
          <CardDescription className="text-base mt-2">
            Dashboard&apos;a erişim için şirket yetkiniz bulunmamaktadır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Dashboard&apos;a erişebilmek için bir şirket yöneticisinin size yetki vermesi gerekmektedir.
            </p>
            <p className="font-medium">
              Lütfen şirket yöneticinizle iletişime geçin.
            </p>
          </div>
          <UnauthorizedActions />
        </CardContent>
      </Card>
    </div>
  );
}
