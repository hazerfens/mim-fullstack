
import Image from "next/image";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş Yap - Mim Reklam",
  description: "Mim Reklam yönetim paneline giriş yapın. Hesabınıza güvenli bir şekilde erişin.",
  robots: {
    index: false,
    follow: false,
  },
};

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-3">
      <div className="hidden bg-muted/40 lg:block lg:col-span-2">
        <div className="relative h-full w-full">
          <Image
            src="https://images.pexels.com/photos/2086622/pexels-photo-2086622.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
            fill
            priority
            alt=""
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      </div>
      <div className="lg:col-span-1">
        <div className="flex h-screen w-full items-center justify-center">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
