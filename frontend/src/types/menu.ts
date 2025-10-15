// Menu system types
export interface Menu {
  id: string;
  menu_category_id: string;
  title: string;
  description?: string;
  slug?: string;
  url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  menu_category?: MenuCategory;
  sub_menus?: SubMenu[];
  featured_items?: MenuFeaturedItem[];
  items?: MenuItem[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  slug?: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  menus?: Menu[];
}

export interface SubMenu {
  id: string;
  menu_id: string;
  name: string;
  description?: string;
  image_url?: string;
  slug?: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  menu?: Menu;
}

export interface MenuItem {
  id: string;
  menu_id: string;
  name: string;
  description?: string;
  image_url?: string;
  slug?: string;
  url?: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  menu?: Menu;
}

export interface MenuFeaturedItem {
  id: string;
  menu_id: string;
  name: string;
  description?: string;
  image_url?: string;
  slug?: string;
  url?: string;
  price: number;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  menu?: Menu;
}