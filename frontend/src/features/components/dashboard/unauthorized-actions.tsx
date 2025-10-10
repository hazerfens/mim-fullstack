"use client"

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLogoutClient } from '@/stores/session-store';
import { useCompanyStore } from "@/stores/company-store";
import { toast } from "sonner";
import { useState } from "react";

export function UnauthorizedActions() {
  const router = useRouter();
  const { clearCompanies } = useCompanyStore();
  const logoutClient = useLogoutClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSwitchAccount = async () => {
    try {
      setIsLoggingOut(true);
      const res = await logoutClient();
      if (res.status !== 'success') {
        toast.error(res.message || 'Çıkış sırasında bir hata oluştu');
        setIsLoggingOut(false);
        return;
      }
      clearCompanies();
  toast.success("Çıkış yapıldı");
  router.replace('/auth/login');
    } catch (error) {
      console.error("Logout error", error);
      toast.error("Çıkış sırasında bir hata oluştu");
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 pt-4">
      <Button 
        onClick={() => router.push('/')} 
        variant="default" 
        className="w-full"
      >
        Ana Sayfa
      </Button>
      <Button 
        onClick={handleSwitchAccount} 
        variant="outline" 
        className="w-full"
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Çıkış yapılıyor...
          </>
        ) : (
          "Farklı Hesapla Giriş Yap"
        )}
      </Button>
    </div>
  );
}
