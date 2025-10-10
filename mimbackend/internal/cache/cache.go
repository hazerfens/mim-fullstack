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
