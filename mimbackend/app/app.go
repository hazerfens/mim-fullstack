package app

// @title MimReklam API
// @version 1.0
// @description API for MimReklam backend
// @host localhost:3333
// @BasePath /api/v1

import (
	"log"
	"mimbackend/app/migrations"
	"mimbackend/config"
	"mimbackend/internal/routes"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var router *gin.Engine

func StartApp() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: Error loading .env file: %v", err)
	}

	// DB init
	config.NewConnection()

	// Migration çalıştır
	migrations.RunMigrations()

	// Opsiyonel: seed verileri yükle
	// migrations.SeedData()

	// Gin router başlat
	setupRouter()
	startServer()
}

func setupRouter() {
	router = routes.NewRouter()
}

func startServer() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3333"
	}

	addr := ":" + port
	base := os.Getenv("BASE_URL")
	if base == "" {
		base = "http://localhost:" + port
	}

	log.Printf("🚀 Server starting on %s", base)
	log.Printf("📊 Health check available at: %s/health", base)

	apiPrefix := os.Getenv("API_PREFIX")
	if apiPrefix == "" {
		apiPrefix = "/api/v1"
	}

	log.Printf("🔐 Auth endpoints available at: %s%s/auth/*", base, apiPrefix)
	log.Printf("🌐 OAuth endpoints available at: %s%s/auth/*", base, apiPrefix)
	log.Printf("🛡️  Protected endpoints available at: %s%s/api/*", base, apiPrefix)

	err := router.Run(addr)
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
