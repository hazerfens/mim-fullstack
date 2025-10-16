"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { MegaMenu } from "./mega-menu";
import TopBar from "./top-bar";
import { getMenus } from "@/features/actions/dashboard/settings/menu-actions";
import type { MenuCategory } from "@/types/menu";

// User tipi tanımlaması
interface UserProps {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  role: "customer" | "user" | "admin" | "super_admin";
}

interface HeaderProps {
  user?: UserProps;
}

const Header = ({ user }: HeaderProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);

  // Component mount olduktan sonra animasyonu başlat ve menü verilerini yükle
  useEffect(() => {
    setIsLoaded(true);
    
    const loadMenuCategories = async () => {
      try {
        const data = await getMenus();
        // Sadece aktif kategorileri göster
        const activeCategories = data.filter((category: MenuCategory) => category.is_active);
        setMenuCategories(activeCategories);
      } catch (error) {
        console.error('Menü kategorileri yüklenirken hata:', error);
        setMenuCategories([]);
      }
    };

    loadMenuCategories();
  }, []);

  // Header için animasyon varyantları
  const headerVariants = {
    hidden: { y: -100, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      },
    },
  };

  return (
    <AnimatePresence>
      <motion.header
        className="sticky top-0 w-full bg-card shadow-sm z-50 md:block" // Hide on mobile
        initial="hidden"
        animate={isLoaded ? "visible" : "hidden"}
        variants={headerVariants}
      >
        {" "}
        
        <TopBar user={user} />
        <div className="container mx-auto px-5 py-2">
          <div className="flex items-center justify-between">
            {/* Sol: Ana Navigasyon */}
            <div className="flex items-center space-x-6">
              {menuCategories.length > 0 ? (
                menuCategories.map((category) => {
                  const hasSubmenuMenus = category.menus?.some(menu => menu.is_active && (menu.sub_menus && menu.sub_menus.length > 0))
                  const directMenus = category.menus?.filter(menu => menu.is_active && (!menu.sub_menus || menu.sub_menus.length === 0)) || []
                  return (
                    <div key={category.id} className="flex items-center space-x-4">
                      {/* Category title: open mega menu if there are submenu groups */}
                      {hasSubmenuMenus ? (
                        <MegaMenu key={category.id} categoryId={category.id}>
                          <div className="flex items-center text-foreground font-medium hover:text-primary transition-colors cursor-pointer">
                            {category.name}
                          </div>
                        </MegaMenu>
                      ) : (
                        <Link href={`/${category.slug?.replace(/^\//, '')}`}>{category.name}</Link>
                      )}

                      {/* Direct link menus (no submenus) */}
                      {directMenus.map((menu) => {
                        const href = menu.url || `/${[category.slug, menu.slug].map(s => s?.replace(/^\//, '')).filter(Boolean).join('/')}`
                        return (
                          <Link key={menu.id} href={href} className="text-foreground font-medium hover:text-primary transition-colors">
                            {menu.title}
                          </Link>
                        )
                      })}
                    </div>
                  )
                })
              ) : (
                <div className="flex items-center text-foreground font-medium">
                  MENÜ
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.header>
    </AnimatePresence>
  );
};

export default Header;
