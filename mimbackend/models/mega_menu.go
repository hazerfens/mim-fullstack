package models

import (
	"time"

	"github.com/google/uuid"
)

// MegaMenuItem represents a single menu item in the mega menu
type MegaMenuItem struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description,omitempty" db:"description"`
	ImageURL    string    `json:"image_url,omitempty" db:"image_url"`
	Slug        string    `json:"slug,omitempty" db:"slug"`
	URL         string    `json:"url,omitempty" db:"url"`
	Order       int       `json:"order" db:"order"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// MegaMenuCategory represents a category in the mega menu
type MegaMenuCategory struct {
	ID          uuid.UUID      `json:"id" db:"id"`
	Name        string         `json:"name" db:"name"`
	Description string         `json:"description,omitempty" db:"description"`
	ImageURL    string         `json:"image_url,omitempty" db:"image_url"`
	Slug        string         `json:"slug,omitempty" db:"slug"`
	Order       int            `json:"order" db:"order"`
	IsActive    bool           `json:"is_active" db:"is_active"`
	Items       []MegaMenuItem `json:"items,omitempty" db:"items"`
	CreatedAt   time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at" db:"updated_at"`
}

// MegaMenuFeaturedItem represents a featured/popular item
type MegaMenuFeaturedItem struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description,omitempty" db:"description"`
	ImageURL    string    `json:"image_url,omitempty" db:"image_url"`
	Slug        string    `json:"slug,omitempty" db:"slug"`
	URL         string    `json:"url,omitempty" db:"url"`
	Price       float64   `json:"price,omitempty" db:"price"`
	Order       int       `json:"order" db:"order"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// MegaMenu represents the main mega menu configuration
type MegaMenu struct {
	ID                uuid.UUID             `json:"id" db:"id"`
	Title             string                `json:"title" db:"title"`
	Description       string                `json:"description,omitempty" db:"description"`
	IsActive          bool                  `json:"is_active" db:"is_active"`
	Categories        []MegaMenuCategory    `json:"categories,omitempty" db:"categories"`
	FeaturedItems     []MegaMenuFeaturedItem `json:"featured_items,omitempty" db:"featured_items"`
	MaxCategories     int                   `json:"max_categories" db:"max_categories"`
	MaxItemsPerCategory int                `json:"max_items_per_category" db:"max_items_per_category"`
	MaxFeaturedItems  int                   `json:"max_featured_items" db:"max_featured_items"`
	CreatedAt         time.Time             `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time             `json:"updated_at" db:"updated_at"`
}