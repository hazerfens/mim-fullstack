package system

import (
	"net/http"

	systemModels "mimbackend/internal/models/system"
	"mimbackend/internal/services/system"

	"github.com/gin-gonic/gin"
)

// GetMenu godoc
// @Summary Get active menu with categories and items
// @Description Get the active menu configuration with all categories, items and featured items
// @Tags system-menu
// @Accept json
// @Produce json
// @Success 200 {object} systemModels.Menu
// @Router /api/system/menu [get]
func GetMenu(c *gin.Context) {
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	menu, err := service.GetActiveMenu()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch menu"})
		return
	}

	if menu == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active menu found"})
		return
	}

	c.JSON(http.StatusOK, menu)
}

// GetMenuCategories godoc
// @Summary Get all menu categories with menus (public for display)
// @Description Get all active menu categories with their associated active menus
// @Tags system-menu
// @Accept json
// @Produce json
// @Success 200 {array} systemModels.MenuCategory
// @Router /api/system/menu-categories [get]
func GetMenuCategories(c *gin.Context) {
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	categories, err := service.GetActiveMenuCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch menu categories"})
		return
	}

	c.JSON(http.StatusOK, categories)
}

// GetAllMenuCategories godoc
// @Summary Get all menu categories with menus (admin)
// @Description Get all menu categories with their associated menus (including inactive)
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} systemModels.MenuCategory
// @Router /api/admin/system/menu-categories [get]
func GetAllMenuCategories(c *gin.Context) {
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	categories, err := service.GetAllMenuCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch menu categories"})
		return
	}

	c.JSON(http.StatusOK, categories)
}

// CreateMenu godoc
// @Summary Create a new menu (admin)
// @Description Create a new menu configuration
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param menu body systemModels.Menu true "Menu data"
// @Success 201 {object} systemModels.Menu
// @Router /api/admin/system/menus [post]
func CreateMenu(c *gin.Context) {
	var menu systemModels.Menu
	if err := c.ShouldBindJSON(&menu); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.CreateMenu(&menu); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create menu"})
		return
	}

	c.JSON(http.StatusCreated, menu)
}

// UpdateMenu godoc
// @Summary Update a menu (admin)
// @Description Update an existing menu configuration
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Menu ID"
// @Param menu body systemModels.Menu true "Menu data"
// @Success 200 {object} systemModels.Menu
// @Router /api/admin/system/menus/{id} [put]
func UpdateMenu(c *gin.Context) {
	id := c.Param("id")

	var menu systemModels.Menu
	if err := c.ShouldBindJSON(&menu); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	menu.ID = id
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.UpdateMenu(&menu); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update menu"})
		return
	}

	c.JSON(http.StatusOK, menu)
}

// DeleteMenu godoc
// @Summary Delete a menu (admin)
// @Description Delete a menu configuration
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Menu ID"
// @Success 204 "No Content"
// @Router /api/admin/system/menus/{id} [delete]
func DeleteMenu(c *gin.Context) {
	id := c.Param("id")

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.DeleteMenu(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete menu"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// CreateMenuCategory godoc
// @Summary Create a menu category (admin)
// @Description Create a new category for a menu
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param category body systemModels.MenuCategory true "Category data"
// @Success 201 {object} systemModels.MenuCategory
// @Router /api/admin/system/menu-categories [post]
func CreateMenuCategory(c *gin.Context) {
	var category systemModels.MenuCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.CreateMenuCategory(&category); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category"})
		return
	}

	c.JSON(http.StatusCreated, category)
}

// UpdateMenuCategory godoc
// @Summary Update a menu category (admin)
// @Description Update an existing menu category
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Category ID"
// @Param category body systemModels.MenuCategory true "Category data"
// @Success 200 {object} systemModels.MenuCategory
// @Router /api/admin/system/menu-categories/{id} [put]
func UpdateMenuCategory(c *gin.Context) {
	id := c.Param("id")

	var category systemModels.MenuCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	category.ID = id
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.UpdateMenuCategory(&category); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category"})
		return
	}

	c.JSON(http.StatusOK, category)
}

// DeleteMenuCategory godoc
// @Summary Delete a menu category (admin)
// @Description Delete a menu category
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Category ID"
// @Success 204 "No Content"
// @Router /api/admin/system/menu-categories/{id} [delete]
func DeleteMenuCategory(c *gin.Context) {
	id := c.Param("id")

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.DeleteMenuCategory(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// CreateMenuItem godoc
// @Summary Create a menu item (admin)
// @Description Create a new item for a menu category
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param item body systemModels.MenuItem true "Item data"
// @Success 201 {object} systemModels.MenuItem
// @Router /api/admin/system/menu-items [post]
func CreateMenuItem(c *gin.Context) {
	var item systemModels.MenuItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.CreateMenuItem(&item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create item"})
		return
	}

	c.JSON(http.StatusCreated, item)
}

// UpdateMenuItem godoc
// @Summary Update a menu item (admin)
// @Description Update an existing menu item
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Item ID"
// @Param item body systemModels.MenuItem true "Item data"
// @Success 200 {object} systemModels.MenuItem
// @Router /api/admin/system/menu-items/{id} [put]
func UpdateMenuItem(c *gin.Context) {
	id := c.Param("id")

	var item systemModels.MenuItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item.ID = id
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.UpdateMenuItem(&item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update item"})
		return
	}

	c.JSON(http.StatusOK, item)
}

// DeleteMenuItem godoc
// @Summary Delete a menu item (admin)
// @Description Delete a menu item
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Item ID"
// @Success 204 "No Content"
// @Router /api/admin/system/menu-items/{id} [delete]
func DeleteMenuItem(c *gin.Context) {
	id := c.Param("id")

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.DeleteMenuItem(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete item"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// CreateMenuFeaturedItem godoc
// @Summary Create a featured item (admin)
// @Description Create a new featured item for menu
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param item body systemModels.MenuFeaturedItem true "Featured item data"
// @Success 201 {object} systemModels.MenuFeaturedItem
// @Router /api/admin/system/menu-featured-items [post]
func CreateMenuFeaturedItem(c *gin.Context) {
	var item systemModels.MenuFeaturedItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.CreateMenuFeaturedItem(&item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create featured item"})
		return
	}

	c.JSON(http.StatusCreated, item)
}

// UpdateMenuFeaturedItem godoc
// @Summary Update a featured item (admin)
// @Description Update an existing featured item
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Featured item ID"
// @Param item body systemModels.MenuFeaturedItem true "Featured item data"
// @Success 200 {object} systemModels.MenuFeaturedItem
// @Router /api/admin/system/menu-featured-items/{id} [put]
func UpdateMenuFeaturedItem(c *gin.Context) {
	id := c.Param("id")

	var item systemModels.MenuFeaturedItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item.ID = id
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.UpdateMenuFeaturedItem(&item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update featured item"})
		return
	}

	c.JSON(http.StatusOK, item)
}

// DeleteMenuFeaturedItem godoc
// @Summary Delete a featured item (admin)
// @Description Delete a featured item
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Featured item ID"
// @Success 204 "No Content"
// @Router /api/admin/system/menu-featured-items/{id} [delete]
func DeleteMenuFeaturedItem(c *gin.Context) {
	id := c.Param("id")

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.DeleteMenuFeaturedItem(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete featured item"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// UpdateMenuOrder godoc
// @Summary Update category/item order (admin)
// @Description Update the display order of categories or items
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param type query string true "Type: category or item or featured"
// @Param orders body []map[string]interface{} true "Order updates"
// @Success 200 {object} map[string]string
// @Router /api/admin/system/menu/order [put]
func UpdateMenuOrder(c *gin.Context) {
	orderType := c.Query("type")
	if orderType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type parameter is required"})
		return
	}

	var orders []map[string]interface{}
	if err := c.ShouldBindJSON(&orders); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.UpdateMenuOrder(orderType, orders); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order updated successfully"})
}

// CreateMenuTables godoc
// @Summary Create menu tables dynamically (admin)
// @Description Create all menu-related tables in the database
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]string
// @Router /api/admin/system/create-menu-tables [post]
func CreateMenuTables(c *gin.Context) {
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.CreateMenuTables(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create menu tables"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Menu tables created successfully"})
}

// CreateSubMenu godoc
// @Summary Create a sub-menu (admin)
// @Description Create a new sub-menu for a menu
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param subMenu body systemModels.SubMenu true "SubMenu data"
// @Success 201 {object} systemModels.SubMenu
// @Router /api/admin/system/sub-menus [post]
func CreateSubMenu(c *gin.Context) {
	var subMenu systemModels.SubMenu
	if err := c.ShouldBindJSON(&subMenu); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.CreateSubMenu(&subMenu); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sub-menu"})
		return
	}

	c.JSON(http.StatusCreated, subMenu)
}

// UpdateSubMenu godoc
// @Summary Update a sub-menu (admin)
// @Description Update an existing sub-menu
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "SubMenu ID"
// @Param subMenu body systemModels.SubMenu true "SubMenu data"
// @Success 200 {object} systemModels.SubMenu
// @Router /api/admin/system/sub-menus/{id} [put]
func UpdateSubMenu(c *gin.Context) {
	id := c.Param("id")

	var subMenu systemModels.SubMenu
	if err := c.ShouldBindJSON(&subMenu); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	subMenu.ID = id
	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.UpdateSubMenu(&subMenu); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update sub-menu"})
		return
	}

	c.JSON(http.StatusOK, subMenu)
}

// DeleteSubMenu godoc
// @Summary Delete a sub-menu (admin)
// @Description Delete a sub-menu
// @Tags system-menu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "SubMenu ID"
// @Success 204 "No Content"
// @Router /api/admin/system/sub-menus/{id} [delete]
func DeleteSubMenu(c *gin.Context) {
	id := c.Param("id")

	service, err := system.NewMenuService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize menu service"})
		return
	}

	if err := service.DeleteSubMenu(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete sub-menu"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
