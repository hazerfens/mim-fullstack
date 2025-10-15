package system

import (
	"mimbackend/config"
	systemModels "mimbackend/internal/models/system"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MenuService handles menu-related operations
type MenuService struct {
	db *gorm.DB
}

// NewMenuService creates a new menu service
func NewMenuService() (*MenuService, error) {
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}
	return &MenuService{db: db}, nil
}

// GetActiveMenu gets the active menu with all related data
func (s *MenuService) GetActiveMenu() (*systemModels.Menu, error) {
	var menu systemModels.Menu
	err := s.db.Where("is_active = ?", true).
		Preload("MenuCategory").
		Preload("SubMenus", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("`order`")
		}).
		Preload("FeaturedItems", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("`order`")
		}).
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("`order`")
		}).
		First(&menu).Error

	if err != nil {
		return nil, err
	}

	return &menu, nil
}

// GetAllMenus gets all menus
func (s *MenuService) GetAllMenus() ([]systemModels.Menu, error) {
	var menus []systemModels.Menu
	err := s.db.Preload("MenuCategory").
		Preload("SubMenus", func(db *gorm.DB) *gorm.DB {
			return db.Order("`order`").Preload("Items", func(db *gorm.DB) *gorm.DB {
				return db.Order("`order`")
			})
		}).
		Preload("FeaturedItems", func(db *gorm.DB) *gorm.DB {
			return db.Order("`order`")
		}).
		Find(&menus).Error

	return menus, err
}

// GetAllMenuCategories gets all menu categories with their menus
func (s *MenuService) GetAllMenuCategories() ([]systemModels.MenuCategory, error) {
	var categories []systemModels.MenuCategory
	err := s.db.Preload("Menus", func(db *gorm.DB) *gorm.DB {
		return db.Preload("MenuCategory").
			Preload("SubMenus", func(db *gorm.DB) *gorm.DB {
				return db.Order("`order`")
			}).
			Preload("FeaturedItems", func(db *gorm.DB) *gorm.DB {
				return db.Order("`order`")
			}).
			Preload("Items", func(db *gorm.DB) *gorm.DB {
				return db.Order("`order`")
			})
	}).
		Find(&categories).Error

	return categories, err
}

// GetActiveMenuCategories gets only active menu categories with their active menus for public display
func (s *MenuService) GetActiveMenuCategories() ([]systemModels.MenuCategory, error) {
	var categories []systemModels.MenuCategory
	err := s.db.Where("is_active = ?", true).Preload("Menus", func(db *gorm.DB) *gorm.DB {
		return db.Where("is_active = ?", true).Preload("MenuCategory").
			Preload("SubMenus", func(db *gorm.DB) *gorm.DB {
				return db.Where("is_active = ?", true).Order("`order`")
			}).
			Preload("FeaturedItems", func(db *gorm.DB) *gorm.DB {
				return db.Where("is_active = ?", true).Order("`order`")
			}).
			Preload("Items", func(db *gorm.DB) *gorm.DB {
				return db.Where("is_active = ?", true).Order("`order`")
			})
	}).
		Order("`order`").Find(&categories).Error

	return categories, err
}

// CreateMenu creates a new menu
func (s *MenuService) CreateMenu(menu *systemModels.Menu) error {
	menu.ID = uuid.New().String()
	return s.db.Create(menu).Error
}

// UpdateMenu updates an existing menu
func (s *MenuService) UpdateMenu(menu *systemModels.Menu) error {
	return s.db.Save(menu).Error
}

// DeleteMenu deletes a menu
func (s *MenuService) DeleteMenu(id string) error {
	return s.db.Delete(&systemModels.Menu{}, "id = ?", id).Error
}

// CreateMenuCategory creates a new category
func (s *MenuService) CreateMenuCategory(category *systemModels.MenuCategory) error {
	category.ID = uuid.New().String()
	return s.db.Create(category).Error
}

// UpdateMenuCategory updates an existing category
func (s *MenuService) UpdateMenuCategory(category *systemModels.MenuCategory) error {
	return s.db.Save(category).Error
}

// DeleteMenuCategory deletes a category
func (s *MenuService) DeleteMenuCategory(id string) error {
	return s.db.Delete(&systemModels.MenuCategory{}, "id = ?", id).Error
}

// CreateMenuItem creates a new item
func (s *MenuService) CreateMenuItem(item *systemModels.MenuItem) error {
	item.ID = uuid.New().String()
	return s.db.Create(item).Error
}

// UpdateMenuItem updates an existing item
func (s *MenuService) UpdateMenuItem(item *systemModels.MenuItem) error {
	return s.db.Save(item).Error
}

// DeleteMenuItem deletes an item
func (s *MenuService) DeleteMenuItem(id string) error {
	return s.db.Delete(&systemModels.MenuItem{}, "id = ?", id).Error
}

// CreateMenuFeaturedItem creates a new featured item
func (s *MenuService) CreateMenuFeaturedItem(item *systemModels.MenuFeaturedItem) error {
	item.ID = uuid.New().String()
	return s.db.Create(item).Error
}

// UpdateMenuFeaturedItem updates an existing featured item
func (s *MenuService) UpdateMenuFeaturedItem(item *systemModels.MenuFeaturedItem) error {
	return s.db.Save(item).Error
}

// DeleteMenuFeaturedItem deletes a featured item
func (s *MenuService) DeleteMenuFeaturedItem(id string) error {
	return s.db.Delete(&systemModels.MenuFeaturedItem{}, "id = ?", id).Error
}

// CreateSubMenu creates a new sub-menu
func (s *MenuService) CreateSubMenu(subMenu *systemModels.SubMenu) error {
	subMenu.ID = uuid.New().String()
	return s.db.Create(subMenu).Error
}

// UpdateSubMenu updates an existing sub-menu
func (s *MenuService) UpdateSubMenu(subMenu *systemModels.SubMenu) error {
	return s.db.Save(subMenu).Error
}

// DeleteSubMenu deletes a sub-menu
func (s *MenuService) DeleteSubMenu(id string) error {
	return s.db.Delete(&systemModels.SubMenu{}, "id = ?", id).Error
}

// UpdateMenuOrder updates the order of categories, items, or featured items
func (s *MenuService) UpdateMenuOrder(orderType string, orders []map[string]interface{}) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, order := range orders {
			id, ok := order["id"].(string)
			if !ok {
				continue
			}

			orderIndex, ok := order["order"].(float64)
			if !ok {
				continue
			}

			var err error
			switch orderType {
			case "category":
				err = tx.Model(&systemModels.MenuCategory{}).Where("id = ?", id).Update("order", int(orderIndex)).Error
			case "item":
				err = tx.Model(&systemModels.MenuItem{}).Where("id = ?", id).Update("order", int(orderIndex)).Error
			case "featured":
				err = tx.Model(&systemModels.MenuFeaturedItem{}).Where("id = ?", id).Update("order", int(orderIndex)).Error
			}

			if err != nil {
				return err
			}
		}
		return nil
	})
}

// CreateMenuTables creates all menu-related tables dynamically
func (s *MenuService) CreateMenuTables() error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Create menus table
		if err := tx.AutoMigrate(&systemModels.Menu{}); err != nil {
			return err
		}

		// Create menu_categories table
		if err := tx.AutoMigrate(&systemModels.MenuCategory{}); err != nil {
			return err
		}

		// Create menu_items table
		if err := tx.AutoMigrate(&systemModels.MenuItem{}); err != nil {
			return err
		}

		// Create menu_featured_items table
		if err := tx.AutoMigrate(&systemModels.MenuFeaturedItem{}); err != nil {
			return err
		}

		// Create sub_menus table
		if err := tx.AutoMigrate(&systemModels.SubMenu{}); err != nil {
			return err
		}

		return nil
	})
}
