package system

import (
	"time"
)

// Menu represents the main menu configuration
type Menu struct {
	ID             string    `json:"id" gorm:"primaryKey;column:id;type:char(36)"`
	MenuCategoryID string    `json:"menu_category_id" gorm:"type:char(36);not null"`
	Title          string    `json:"title" gorm:"not null;size:255"`
	Description    string    `json:"description" gorm:"type:text"`
	Slug           string    `json:"slug" gorm:"size:255;index"`
	URL            string    `json:"url" gorm:"type:text"`
	IsActive       bool      `json:"is_active" gorm:"default:true"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Relations
	MenuCategory  MenuCategory       `json:"menu_category,omitempty" gorm:"foreignKey:MenuCategoryID"`
	SubMenus      []SubMenu          `json:"sub_menus,omitempty" gorm:"foreignKey:MenuID"`
	FeaturedItems []MenuFeaturedItem `json:"featured_items,omitempty" gorm:"foreignKey:MenuID"`
	Items         []MenuItem         `json:"items,omitempty" gorm:"foreignKey:MenuID"`
}

// SubMenu represents a sub-menu within a main menu
type SubMenu struct {
	ID          string    `json:"id" gorm:"primaryKey;column:id;type:char(36)"`
	MenuID      string    `json:"menu_id" gorm:"type:char(36);not null"`
	Name        string    `json:"name" gorm:"not null;size:255"`
	Description string    `json:"description" gorm:"type:text"`
	ImageURL    string    `json:"image_url" gorm:"type:text"`
	Slug        string    `json:"slug" gorm:"size:255;index"`
	Order       int       `json:"order" gorm:"default:0;column:order"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relations
	Menu Menu `json:"menu,omitempty" gorm:"foreignKey:MenuID"`
}

// MenuCategory represents a category within a menu or sub-menu
type MenuCategory struct {
	ID          string    `json:"id" gorm:"primaryKey;column:id;type:char(36)"`
	Name        string    `json:"name" gorm:"not null;size:255"`
	Description string    `json:"description" gorm:"type:text"`
	ImageURL    string    `json:"image_url" gorm:"type:text"`
	Slug        string    `json:"slug" gorm:"size:255;index"`
	Order       int       `json:"order" gorm:"default:0;column:order"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relations
	Menus []Menu `json:"menus,omitempty" gorm:"foreignKey:MenuCategoryID"`
}

// MenuItem represents an item within a menu category
type MenuItem struct {
	ID          string    `json:"id" gorm:"primaryKey;column:id;type:char(36)"`
	MenuID      string    `json:"menu_id" gorm:"type:char(36);not null"`
	Name        string    `json:"name" gorm:"not null;size:255"`
	Description string    `json:"description" gorm:"type:text"`
	ImageURL    string    `json:"image_url" gorm:"type:text"`
	Slug        string    `json:"slug" gorm:"size:255;index"`
	URL         string    `json:"url" gorm:"type:text"`
	Order       int       `json:"order" gorm:"default:0;column:order"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relations
	Menu Menu `json:"menu,omitempty" gorm:"foreignKey:MenuID"`
}

// MenuFeaturedItem represents a featured/popular item
type MenuFeaturedItem struct {
	ID          string    `json:"id" gorm:"primaryKey;column:id;type:char(36)"`
	MenuID      string    `json:"menu_id" gorm:"type:char(36);not null"`
	Name        string    `json:"name" gorm:"not null;size:255"`
	Description string    `json:"description" gorm:"type:text"`
	ImageURL    string    `json:"image_url" gorm:"type:text"`
	Slug        string    `json:"slug" gorm:"size:255;index"`
	URL         string    `json:"url" gorm:"type:text"`
	Price       float64   `json:"price" gorm:"type:decimal(10,2)"`
	Order       int       `json:"order" gorm:"default:0;column:order"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relations
	Menu Menu `json:"menu,omitempty" gorm:"foreignKey:MenuID"`
}

// TableName overrides
func (Menu) TableName() string             { return "system_menus" }
func (SubMenu) TableName() string          { return "system_sub_menus" }
func (MenuCategory) TableName() string     { return "system_menu_categories" }
func (MenuItem) TableName() string         { return "system_menu_items" }
func (MenuFeaturedItem) TableName() string { return "system_menu_featured_items" }
