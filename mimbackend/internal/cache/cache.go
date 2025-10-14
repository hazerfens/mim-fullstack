package cache

import (
	"context"
	"fmt"
	"time"

	"mimbackend/config"

	"github.com/google/uuid"
	redis "github.com/redis/go-redis/v9"
)

func RolePermissionsKey(id uuid.UUID) string {
	return fmt.Sprintf("role:permissions:%s", id.String())
}

func GetRolePermissionsCache(ctx context.Context, id uuid.UUID) ([]byte, error) {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil, nil
	}
	val, err := cli.Get(ctx, RolePermissionsKey(id)).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return val, nil
}

func SetRolePermissionsCache(ctx context.Context, id uuid.UUID, data []byte, ttl time.Duration) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Set(ctx, RolePermissionsKey(id), data, ttl).Err()
}

func InvalidateRolePermissionsCache(ctx context.Context, id uuid.UUID) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Del(ctx, RolePermissionsKey(id)).Err()
}

// Company members cache
func CompanyMembersKey(companyID uuid.UUID) string {
	return fmt.Sprintf("company:members:%s", companyID.String())
}

func GetCompanyMembersCache(ctx context.Context, companyID uuid.UUID) ([]byte, error) {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil, nil
	}
	val, err := cli.Get(ctx, CompanyMembersKey(companyID)).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return val, nil
}

func SetCompanyMembersCache(ctx context.Context, companyID uuid.UUID, data []byte, ttl time.Duration) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Set(ctx, CompanyMembersKey(companyID), data, ttl).Err()
}

func InvalidateCompanyMembersCache(ctx context.Context, companyID uuid.UUID) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Del(ctx, CompanyMembersKey(companyID)).Err()
}

// Permissions catalog cache
func PermissionsCatalogKey() string {
	return "permissions:catalog"
}

func GetPermissionsCatalogCache(ctx context.Context) ([]byte, error) {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil, nil
	}
	val, err := cli.Get(ctx, PermissionsCatalogKey()).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return val, nil
}

func SetPermissionsCatalogCache(ctx context.Context, data []byte, ttl time.Duration) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Set(ctx, PermissionsCatalogKey(), data, ttl).Err()
}

func InvalidatePermissionsCatalogCache(ctx context.Context) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Del(ctx, PermissionsCatalogKey()).Err()
}

// All permissions cache (including inactive entries)
func PermissionsCatalogAllKey() string {
	return "permissions:catalog:all"
}

func GetPermissionsCatalogAllCache(ctx context.Context) ([]byte, error) {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil, nil
	}
	val, err := cli.Get(ctx, PermissionsCatalogAllKey()).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return val, nil
}

func SetPermissionsCatalogAllCache(ctx context.Context, data []byte, ttl time.Duration) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Set(ctx, PermissionsCatalogAllKey(), data, ttl).Err()
}

func InvalidatePermissionsCatalogAllCache(ctx context.Context) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Del(ctx, PermissionsCatalogAllKey()).Err()
}

// Per-user permission cache (individual resource for a given user)
func UserPermissionKey(userID uuid.UUID, resource string, companyID *uuid.UUID) string {
	if companyID == nil {
		return fmt.Sprintf("user:permissions:%s:%s", userID.String(), resource)
	}
	return fmt.Sprintf("user:permissions:%s:%s:%s", userID.String(), companyID.String(), resource)
}

func GetUserPermissionCache(ctx context.Context, userID uuid.UUID, resource string, companyID *uuid.UUID) ([]byte, error) {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil, nil
	}
	key := UserPermissionKey(userID, resource, companyID)
	val, err := cli.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return val, nil
}

func SetUserPermissionCache(ctx context.Context, userID uuid.UUID, resource string, companyID *uuid.UUID, data []byte, ttl time.Duration) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	key := UserPermissionKey(userID, resource, companyID)
	return cli.Set(ctx, key, data, ttl).Err()
}

func InvalidateUserPermissionCache(ctx context.Context, userID uuid.UUID, resource string, companyID *uuid.UUID) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	key := UserPermissionKey(userID, resource, companyID)
	return cli.Del(ctx, key).Err()
}

// Invalidate all per-user permission caches that reference a given resource.
// This scans Redis keys matching the pattern and removes them. Use with care.
func InvalidateUserPermissionsForResource(ctx context.Context, resource string, companyID *uuid.UUID) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	var pattern string
	if companyID == nil {
		pattern = fmt.Sprintf("user:permissions:*:%s", resource)
	} else {
		pattern = fmt.Sprintf("user:permissions:*:%s:%s", companyID.String(), resource)
	}
	// Use SCAN to iterate keys without blocking Redis
	iter := cli.Scan(ctx, 0, pattern, 0).Iterator()
	var toDelete []string
	for iter.Next(ctx) {
		toDelete = append(toDelete, iter.Val())
		// Batch deletes every 100 keys
		if len(toDelete) >= 100 {
			_ = cli.Del(ctx, toDelete...).Err()
			toDelete = toDelete[:0]
		}
	}
	if len(toDelete) > 0 {
		_ = cli.Del(ctx, toDelete...).Err()
	}
	return iter.Err()
}

// BuildUserPermissionCacheKey builds a cache key for user permissions
func BuildUserPermissionCacheKey(userID uuid.UUID, resource string, companyID *uuid.UUID) string {
	return UserPermissionKey(userID, resource, companyID)
}

// DeleteUserPermissionCache deletes a user permission cache entry
func DeleteUserPermissionCache(ctx context.Context, cacheKey string) error {
	cli := config.GetRedisClient()
	if cli == nil {
		return nil
	}
	return cli.Del(ctx, cacheKey).Err()
}
