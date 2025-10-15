"use client";

import React, { useState } from "react";



import { Button } from "@/components/ui/button";
import { Menu, Search, ShoppingCart, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/features/users/components/user-menu";


// User tipi tanımlaması
interface UserProps {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  role: "customer" | "user" | "admin" | "super_admin";
}

interface TopBarProps {
  user?: UserProps;
}

const TopBar = ({ user }: TopBarProps) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <div className="w-full bg-background py-3 border-b">
      <div className="container mx-auto px-3">
        {/* Ana Bar */}
        <div className="flex items-center justify-between">
          {/* Logo ve Mobil Menü Butonu */}
          <div className="flex items-center gap-2">
            {/* Mobil Menü Butonu - En Sol Başta */}
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menü</span>
            </Button>

            {/* Logo */}
            {/* <Link href="/" className="flex items-center">
              <div className="relative w-auto md:w-[200px] h-10 md:h-8">
                <Image
                  src="/logo.svg"
                  alt="BaskiBurada Logo"
                  fill
                  priority
                  className="object-contain object-left"
                />
              </div>
            </Link> */}
          </div>



          {/* İşlem Butonları */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Mobil Arama Açma/Kapama Butonu */}
            <Button
              variant="ghost"
              size="icon"
              className="relative md:hidden"
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            >
              {mobileSearchOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </Button>

            <ThemeToggle />
            
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
                3
              </span>
            </Button>

            <UserMenu user={user} />
          </div>
        </div>

        {/* Mobil Arama Çubuğu - Koşullu Gösterimi */}
        {mobileSearchOpen && (
          <div className="mt-3 pb-1 md:hidden">
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;
