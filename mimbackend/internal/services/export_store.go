package services

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type ExportRecord struct {
	CompanyID uuid.UUID
	UserID    uuid.UUID
	Filename  string
	Data      []byte
	ExpiresAt time.Time
}

var (
	exportStore = map[string]ExportRecord{}
	exportLock  = sync.RWMutex{}
)

// SaveExport saves export data and returns a token
func SaveExport(rec ExportRecord) string {
	token := uuid.New().String()
	exportLock.Lock()
	defer exportLock.Unlock()
	exportStore[token] = rec
	return token
}

// GetExport retrieves an export record by token
func GetExport(token string) (ExportRecord, bool) {
	exportLock.RLock()
	defer exportLock.RUnlock()
	rec, ok := exportStore[token]
	if !ok {
		return ExportRecord{}, false
	}
	if time.Now().After(rec.ExpiresAt) {
		return ExportRecord{}, false
	}
	return rec, true
}

// DeleteExport removes an export record
func DeleteExport(token string) {
	exportLock.Lock()
	defer exportLock.Unlock()
	delete(exportStore, token)
}
