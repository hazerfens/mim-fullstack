package main

import (
	"fmt"
	"log"
	"mimbackend/config"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: Error loading .env file: %v", err)
	}

	db, err := config.NewConnection()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Drop menu tables to force recreation with new schema
	tables := []string{
		"system_menu_featured_items",
		"system_menu_items",
		"system_sub_menus",
		"system_menus",
		"system_menu_categories",
	}

	for _, table := range tables {
		if err := db.Exec("DROP TABLE IF EXISTS " + table).Error; err != nil {
			log.Printf("Warning: could not drop table %s: %v", table, err)
		} else {
			fmt.Printf("✅ Dropped table: %s\n", table)
		}
	}

	fmt.Println("Menu tables dropped successfully. Restart the server to recreate them.")
}
