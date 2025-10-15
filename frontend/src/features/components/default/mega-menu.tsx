"use client"

import React, { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { X, ChevronDown, ChevronUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { getMenus } from "@/features/actions/dashboard/settings/menu-actions"
import type { MenuCategory, Menu, SubMenu, MenuFeaturedItem } from "@/types/menu"

// Fiyat formatla
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2
  }).format(price);
};

// Resim URL'sini düzgün formata dönüştüren yardımcı fonksiyon
const getImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  
  // Eğer URL zaten http veya https ile başlıyorsa olduğu gibi bırak
  if (url.startsWith('http')) return url;
  
  // Eğer URL public içinde bir dosyaya referans ise
  if (url.startsWith('/')) return url;
  
  // Göreli yolu tam yola çevir
  return `/${url}`;
};

interface MegaMenuProps {
  children: React.ReactNode
  categoryId?: string
  menuId?: string
}

export function MegaMenu({ children, categoryId, menuId }: MegaMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Load menu data
  useEffect(() => {
    const loadMenuData = async () => {
      try {
        const data = await getMenus()
        // Only show active categories and menus
        const activeCategories = data.filter((category: MenuCategory) => 
          category.is_active && category.menus?.some((menu: Menu) => menu.is_active)
        )
        
        if (categoryId && menuId) {
          // Sadece belirli kategori ve menüyü göster
          const filteredCategories = activeCategories
            .filter((cat: MenuCategory) => cat.id === categoryId)
            .map((cat: MenuCategory) => ({
              ...cat,
              menus: cat.menus?.filter((menu: Menu) => menu.id === menuId && menu.is_active)
            }))
            .filter((cat: MenuCategory) => cat.menus && cat.menus.length > 0)
          setMenuCategories(filteredCategories)
        } else if (categoryId) {
          // Sadece belirli kategoriyi göster
          const filteredCategories = activeCategories.filter((cat: MenuCategory) => cat.id === categoryId)
          setMenuCategories(filteredCategories)
        } else {
          // Tüm kategorileri göster
          setMenuCategories(activeCategories)
        }
      } catch (error) {
        console.error('Menü verisi yüklenirken hata:', error)
        // Fallback to empty array
        setMenuCategories([])
      } finally {
        setLoading(false)
      }
    }

    loadMenuData()
  }, [categoryId, menuId])

  // Trigger elemanı dışında bir yere tıklandığında menüyü kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) && 
        triggerRef.current && 
        !triggerRef.current.contains(event.target as Node) &&
        isOpen
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Animasyon varyantları
  const menuVariants = {
    hidden: { 
      opacity: 0,
      y: -20
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3
      }
    },
    exit: { 
      opacity: 0,
      y: -20,
      transition: { 
        duration: 0.2
      }
    }
  }

  // Menüyü aç/kapat
  const handleToggle = () => {
    // Eğer menuId varsa ve loading değilse, veri kontrolü yap
    if (menuId && !loading) {
      const hasMenuData = menuCategories.some(cat => 
        cat.menus?.some(menu => menu.id === menuId && menu.sub_menus && menu.sub_menus.length > 0)
      )
      if (!hasMenuData) return; // Veri yoksa menü açılmasın
    }
    setIsOpen(!isOpen)
  }

  return (
    <>
      <div 
        ref={triggerRef} 
        onClick={handleToggle} 
        className="cursor-pointer flex items-center gap-1"
      >
        {children}
        {isOpen ? 
          <ChevronUp className="h-4 w-4 text-foreground transition-transform duration-200" /> : 
          <ChevronDown className="h-4 w-4 text-foreground transition-transform duration-200" />
        }
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            className="fixed left-0 right-0 top-[100px] w-full bg-background shadow-lg border-t z-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={menuVariants}
          >
            <div className="container mx-auto p-6">
              <div 
                className="absolute right-6 top-6 cursor-pointer" 
                onClick={() => setIsOpen(false)}
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </div>

              <h2 className="text-xl font-bold">
                {menuId ? 
                  menuCategories[0]?.menus?.[0]?.title || "Ürün Kategorileri" : 
                  "Ürün Kategorileri"
                }
              </h2>
              <p className="text-muted-foreground mb-4 text-sm">
                {menuId ? 
                  "Alt menü seçenekleri" : 
                  "İhtiyacınıza göre özel baskı ve promosyon ürünleri"
                }
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Kategori bölümü */}
                <div className="col-span-1 md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menuCategories.map((category) => (
                      <div 
                        key={category.id} 
                        className="space-y-2 border border-border overflow-hidden"
                      >
                        {category.image_url && (
                          <div className="relative w-full h-32 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10 z-10" />
                            <div className="absolute bottom-2 left-3 text-white font-semibold z-20">
                              {category.name}
                            </div>
                            <Image 
                              src={getImageUrl(category.image_url)}
                              alt={category.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
                          </div>
                        )}
                        {!category.image_url && (
                          <div className="p-4 bg-muted/30">
                            <h3 className="font-semibold text-lg">{category.name}</h3>
                            {category.description && (
                              <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                            )}
                          </div>
                        )}
                        <ul className="space-y-1.5 text-sm p-3">
                          {category.menus?.filter(menu => menu.is_active && (!menuId || menu.id === menuId)).map((menu) => {
                            // Sub-menuları göster
                            return menu.sub_menus?.filter(subMenu => subMenu.is_active).slice(0, 5).map((subMenu) => (
                              <li 
                                key={subMenu.id}
                                className="transition-transform duration-200 hover:translate-x-1"
                              >
                                <Link 
                                  href={subMenu.slug ? `/${category.slug}/${menu.slug}/${subMenu.slug}` : '#'}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  onClick={() => setIsOpen(false)}
                                >
                                  {subMenu.name}
                                </Link>
                              </li>
                            ))
                          }).flat().slice(0, 5)}
                          {(category.menus?.filter(menu => menu.is_active && (!menuId || menu.id === menuId)).reduce((total, menu) => {
                            return total + (menu.sub_menus?.filter(sub => sub.is_active).length || 0)
                          }, 0) || 0) > 5 && (
                            <li className="text-xs text-muted-foreground pt-1 italic">
                              + Daha fazla ürün
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Popüler ürünler bölümü */}
                <div className="col-span-1 space-y-4">
                  <h3 className="font-medium text-lg">Popüler Ürünler</h3>
                  <div className="space-y-4">
                    {menuCategories.flatMap(category => 
                      category.menus?.filter(menu => menu.is_active && (!menuId || menu.id === menuId)).flatMap(menu => 
                        menu.featured_items?.filter(item => item.is_active) || []
                      ) || []
                    ).slice(0, 3).map((featuredItem) => (
                      <motion.div 
                        key={featuredItem.id}
                        whileHover={{ scale: 1.03, x: 5 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        <Link 
                          href={featuredItem.url || (featuredItem.slug ? `/products/${featuredItem.slug}` : '#')}
                          className="flex items-center gap-3 group"
                          onClick={() => setIsOpen(false)}
                        >
                          <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
                            {featuredItem.image_url ? (
                              <Image 
                                src={getImageUrl(featuredItem.image_url)} 
                                alt={featuredItem.name}
                                fill
                                className="object-cover group-hover:scale-110 transition-transform duration-300"
                                sizes="64px"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                                <span className="text-muted-foreground text-xs">Resim yok</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium group-hover:text-primary transition-colors">{featuredItem.name}</h4>
                            <p className="text-muted-foreground text-sm">{formatPrice(featuredItem.price)}</p>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                    {menuCategories.flatMap(category => 
                      category.menus?.filter(menu => menu.is_active && (!menuId || menu.id === menuId)).flatMap(menu => 
                        menu.featured_items?.filter(item => item.is_active) || []
                      ) || []
                    ).length === 0 && (
                      <div className="text-muted-foreground text-sm">Henüz öne çıkan ürün bulunmuyor</div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t">
                    <Button 
                      variant="outline" 
                      asChild 
                      className="w-full"
                      onClick={() => setIsOpen(false)}
                    >
                      <Link href="/products">Tüm Ürünleri Keşfet</Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center mt-8 pt-4 border-t">
                <div className="flex flex-col md:flex-row gap-4 mb-4 md:mb-0">
                  <Link 
                    href="/corporate" 
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setIsOpen(false)}
                  >
                    Kurumsal
                  </Link>
                  <Link 
                    href="/about" 
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setIsOpen(false)}
                  >
                    Hakkımızda
                  </Link>
                  <Link 
                    href="/contact" 
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setIsOpen(false)}
                  >
                    İletişim
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
