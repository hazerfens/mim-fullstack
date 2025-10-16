"use client"

import React, { useState, useRef, useEffect } from "react"
// Note: we don't render remote images in this simplified mega menu layout
import Link from "next/link"
import { X, ChevronDown, ChevronUp, Package } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
// Button not needed in megamenu right now
import { getMenus } from "@/features/actions/dashboard/settings/menu-actions"
import type { MenuCategory, Menu } from "@/types/menu"

// Helpers intentionally omitted for simplified layout

interface MegaMenuProps {
  children: React.ReactNode
  categoryId?: string
  menuId?: string
}

export function MegaMenu({ children, categoryId, menuId }: MegaMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(categoryId)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Load menu data
  useEffect(() => {
    const loadMenuData = async () => {
      try {
        const data = await getMenus()
        // Only show active categories that have menus with active submenus
        const activeCategories = data
          .filter((category: MenuCategory) => category.is_active && category.menus?.some((menu: Menu) => menu.is_active && menu.sub_menus?.some(sm => sm.is_active)))
          // sort by order if available
          .sort((a: MenuCategory, b: MenuCategory) => (a.order ?? 0) - (b.order ?? 0))

        // Set selected category to provided prop or first active
        const initialSelected = categoryId ?? activeCategories[0]?.id
        setSelectedCategory(initialSelected)

        setMenuCategories(activeCategories)

        // (removed standalone menus logic - handled in header)
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

  // Close on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
    if (menuId && !loading) {
      const hasMenuData = menuCategories.some(cat => 
        cat.menus?.some(menu => menu.id === menuId && menu.sub_menus && menu.sub_menus.length > 0)
      )
      if (!hasMenuData) return;
    }
    setIsOpen(!isOpen)
  }

  const handleKeyToggle = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }

  // Derive current category and menus to display
  const currentCat = menuCategories.find(cat => cat.id === selectedCategory)
  const menusToShow = React.useMemo(() => {
    if (!currentCat) return []
    if (menuId) return currentCat.menus?.filter(m => m.id === menuId && m.is_active && (m.sub_menus?.some(sm => sm.is_active))) || []
    return currentCat.menus?.filter(m => m.is_active && (m.sub_menus?.some(sm => sm.is_active))) || []
  }, [currentCat, menuId])

  const [activeMenuId, setActiveMenuId] = useState<string | undefined>(menuId ?? undefined)

  // Set initial active menu when the visible menus change or when opening
  useEffect(() => {
    if (menuId) {
      setActiveMenuId(menuId)
    } else {
      setActiveMenuId(menusToShow?.[0]?.id)
    }
  }, [menusToShow, menuId])

  return (
    <>
      <div 
        ref={triggerRef} 
        onClick={handleToggle} 
        onKeyDown={handleKeyToggle}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        className="cursor-pointer flex items-center gap-1 focus:outline-none"
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

              <div className="text-sm text-muted-foreground mb-4">Hızlıca gezinmek için kategorilere tıklayın veya çözümleri keşfedin.</div>

              <div className="grid grid-cols-12 gap-6">
                {/* Left: menu groups (stacked) for the selected category */}
                <div className="col-span-12 md:col-span-3 relative">
                  {/* Notch: blank space on the right of left column that matches the protrusion */}
                  <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background z-40 pointer-events-none hidden md:block" />
                  <div className="space-y-2">
                    {menusToShow.length === 0 && <div className="text-muted-foreground">Bu kategoride gösterilecek menü yok</div>}
                    {menusToShow.map(menu => (
                      <div key={menu.id} onMouseEnter={() => setActiveMenuId(menu.id)} tabIndex={0} role="button" className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted/60 transition-colors flex items-center gap-3 ${activeMenuId === menu.id ? 'bg-muted/80 font-semibold' : ''}`}>
                        <div className="w-10 h-10 flex items-center justify-center rounded bg-primary/10 text-primary"><Package className="w-5 h-5" /></div>
                        <div>
                          <div className="text-sm">{menu.title}</div>
                          {menu.description && <div className="text-xs text-muted-foreground">{menu.description}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Middle: submenu cards for the active menu */}
                <div className="col-span-12 md:col-span-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {menusToShow.find(m => m.id === activeMenuId)?.sub_menus?.filter(sm => sm.is_active).map(sm => (
                      <div key={sm.id} className="p-4 border rounded-md bg-white h-28 flex flex-col justify-center">
                        <Link href={`/${[currentCat?.slug, menusToShow.find(m => m.id === activeMenuId)?.slug, sm.slug].map(s => s?.replace(/^\//, '')).filter(Boolean).join('/')}`} className="text-lg font-semibold mb-1 block">{sm.name}</Link>
                        {sm.description && <p className="text-sm text-muted-foreground">{sm.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: news / announcements placeholder */}
                <div className="col-span-12 md:col-span-3 relative">
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Duyurular</div>
                    <div className="p-4 border rounded-md min-h-[140px] flex items-center justify-center text-muted-foreground">Boş</div>
                  </div>
                </div>
                {/* Protrusion between left and middle: a rounded div that extends from the middle panel */}
                <div className="absolute left-1/4 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden md:block">
                  <div className="w-12 h-12 bg-background rounded-full shadow-md" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
