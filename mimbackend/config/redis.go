package config

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/redis/go-redis/v9"
)

var (
	redisClient *redis.Client
	redisOnce   sync.Once
)

// NewRedisClient initializes a singleton Redis client using environment variables.
func NewRedisClient() (*redis.Client, error) {
	var err error
	redisOnce.Do(func() {
		// Prefer full URL if provided
		redisURL := os.Getenv("REDIS_URL")
		if redisURL != "" {
			opt, e := redis.ParseURL(redisURL)
			if e != nil {
				err = e
				return
			}
			redisClient = redis.NewClient(opt)
			return
		}

		host := os.Getenv("REDIS_HOST")
		if host == "" {
			host = "127.0.0.1"
		}
		port := os.Getenv("REDIS_PORT")
		if port == "" {
			port = "6379"
		}
		addr := fmt.Sprintf("%s:%s", host, port)
		password := os.Getenv("REDIS_PASSWORD")

		redisClient = redis.NewClient(&redis.Options{
			Addr:     addr,
			Password: password,
			DB:       0,
		})
	})
	if redisClient == nil {
		return nil, err
	}
	// Ping to verify connection (best-effort)
	if pingErr := redisClient.Ping(context.Background()).Err(); pingErr != nil {
		log.Printf("redis: ping failed: %v", pingErr)
		return nil, pingErr
	}
	return redisClient, nil
}

// GetRedisClient returns the initialized redis client or nil if not available.
// It will attempt to initialize the client lazily.
func GetRedisClient() *redis.Client {
	if redisClient != nil {
		return redisClient
	}
	c, err := NewRedisClient()
	if err != nil {
		return nil
	}
	return c
}
