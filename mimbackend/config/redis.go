package config

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
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
	// Ping to verify connection (best-effort). If the server rejects AUTH
	// because it doesn't have a password configured, try reconnecting
	// without a password as a developer-focused fallback (useful for WSL/dev).
	ctx := context.Background()
	if pingErr := redisClient.Ping(ctx).Err(); pingErr != nil {
		log.Printf("redis: ping failed: %v", pingErr)
		// If the server complains about receiving AUTH when no password is set,
		// attempt a retry without sending a password (fallback for local/dev).
		if strings.Contains(pingErr.Error(), "Client sent AUTH, but no password is set") {
			log.Printf("redis: ping failed due to AUTH mismatch; retrying without password as a fallback")
			// Recreate client without password
			// Try to preserve options if ParseURL was used by rebuilding from REDIS_URL
			redisURL := os.Getenv("REDIS_URL")
			if redisURL != "" {
				if opt, e := redis.ParseURL(redisURL); e == nil {
					opt.Password = ""
					redisClient = redis.NewClient(opt)
				} else {
					// fall back to host/port
					host := os.Getenv("REDIS_HOST")
					if host == "" {
						host = "127.0.0.1"
					}
					port := os.Getenv("REDIS_PORT")
					if port == "" {
						port = "6379"
					}
					addr := fmt.Sprintf("%s:%s", host, port)
					redisClient = redis.NewClient(&redis.Options{Addr: addr, DB: 0})
				}
			} else {
				host := os.Getenv("REDIS_HOST")
				if host == "" {
					host = "127.0.0.1"
				}
				port := os.Getenv("REDIS_PORT")
				if port == "" {
					port = "6379"
				}
				addr := fmt.Sprintf("%s:%s", host, port)
				redisClient = redis.NewClient(&redis.Options{Addr: addr, DB: 0})
			}

			if pingErr2 := redisClient.Ping(ctx).Err(); pingErr2 != nil {
				log.Printf("redis: ping retry without password failed: %v", pingErr2)
				return nil, pingErr2
			}
			// success on retry
			log.Printf("redis: connected without password (fallback)")
		} else {
			return nil, pingErr
		}
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

// PublishRedisMessage publishes a message to a Redis channel. Best-effort.
func PublishRedisMessage(channel string, msg string) error {
	cli := GetRedisClient()
	if cli == nil {
		return nil
	}
	ctx := context.Background()
	return cli.Publish(ctx, channel, msg).Err()
}
