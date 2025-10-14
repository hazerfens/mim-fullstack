package app

// @title MimReklam API
// @version 1.0
// @description API for MimReklam backend
// @host localhost:3333
// @BasePath /api/v1

import (
	"context"
	"fmt"
	"log"
	"mimbackend/app/migrations"
	"mimbackend/config"
	"mimbackend/internal/routes"
	"mimbackend/internal/services"
	"os"
	"time"

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

	// Redis init (optional cache layer) — attempt to connect and log status.
	redisClient, rErr := config.NewRedisClient()
	if rErr != nil {
		log.Printf("⚠️  Redis not available or ping failed: %v — cache layer disabled", rErr)
	} else if redisClient != nil {
		// Prefer REDIS_URL for message if present
		redisURL := os.Getenv("REDIS_URL")
		host := os.Getenv("REDIS_HOST")
		port := os.Getenv("REDIS_PORT")
		if redisURL != "" {
			log.Printf("✅ Redis connected (REDIS_URL=%s)", redisURL)
		} else {
			if host == "" {
				host = "127.0.0.1"
			}
			if port == "" {
				port = "6379"
			}
			log.Printf("✅ Redis connected at %s:%s", host, port)
		}
		// Quick cache set/get test to verify runtime cache operations
		ctx := context.Background()
		testKey := "mim:cache:test"
		testVal := fmt.Sprintf("%d", time.Now().Unix())
		if err := redisClient.Set(ctx, testKey, testVal, 5*time.Second).Err(); err != nil {
			log.Printf("⚠️  Redis cache set failed: %v", err)
		} else {
			got, gErr := redisClient.Get(ctx, testKey).Result()
			if gErr != nil {
				log.Printf("⚠️  Redis cache get failed: %v", gErr)
			} else if got != testVal {
				log.Printf("⚠️  Redis cache mismatch (set %s but got %s)", testVal, got)
			} else {
				log.Printf("🔁 Redis cache test OK — set/get roundtrip succeeded")
			}
		}
	}

	// Migration çalıştır
	migrations.RunMigrations()

	// Initialize Casbin ABAC enforcer
	if err := services.InitCasbin(); err != nil {
		log.Fatalf("Failed to initialize Casbin: %v", err)
	}

	// Initialize default policies
	if err := services.InitializeDefaultPolicies(); err != nil {
		log.Printf("Warning: Failed to initialize default policies: %v", err)
	}

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
