package config

import (
	"fmt"
	"log"
	"os"
	"sync"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	dbInstance *gorm.DB
	dbErr      error
	once       sync.Once
)

// NewConnection, .env dosyasındaki bilgilere göre yeni bir veritabanı bağlantısı oluşturur.
func NewConnection() (*gorm.DB, error) {
	once.Do(func() {
		host := os.Getenv("DB_HOST")
		port := os.Getenv("DB_PORT")
		user := os.Getenv("DB_USER")
		password := os.Getenv("DB_PASSWORD")
		dbname := os.Getenv("DB_NAME")

		// Veritabanı bağlantı dizesi (DSN)
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			user, password, host, port, dbname)

		// Configure GORM logger to warn level and ignore ErrRecordNotFound
		newLogger := logger.New(
			log.New(os.Stdout, "\r\n", log.LstdFlags),
			logger.Config{
				LogLevel:                  logger.Warn,
				IgnoreRecordNotFoundError: true,
			},
		)

		db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
			Logger: newLogger,
		})
		if err != nil {
			dbErr = fmt.Errorf("veritabanına bağlanılamadı: %w", err)
			return
		}

		dbInstance = db
		log.Println("Veritabanı bağlantısı başarıyla kuruldu.")
	})
	if dbErr != nil {
		return nil, dbErr
	}
	return dbInstance, nil
}
