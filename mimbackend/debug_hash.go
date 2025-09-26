package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func main() {
	// Veritabanındaki token (JSON'dan çıkarılan)
	tokenFromDB := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhhemVyZmVuQGdtYWlsLmNvbSIsInJvbGUiOiJ1c2VyIiwiaXNzIjoiY2FtcGluZy1jbG91ZHMiLCJzdWIiOiIyNGEyYmJjOS03MDgwLTQzZDQtOWNiNi04MjViY2I1NjM3ZDciLCJleHAiOjE3NjEzOTk5NDcsIm5iZiI6MTc1ODgwNzk0NywiaWF0IjoxNzU4ODA3OTQ3fQ.h3QcfOPYhz_8TSI1tyQ2tcPgskFIXFD82IimUeYfDpU"

	// Hash hesapla
	hash := sha256.Sum256([]byte(tokenFromDB))
	hashStr := hex.EncodeToString(hash[:])

	fmt.Printf("Token length: %d\n", len(tokenFromDB))
	fmt.Printf("Calculated hash: %s\n", hashStr)
	fmt.Printf("DB hash:         25e9bab255898532d470c0259bf609dd86f6d80fed5f401bdc36504f355abde9\n")
	fmt.Printf("Searched hash:   c8fb4e2373e076b3feec178c6da90944ae1ef8de755d7c40d9b1d8ecb7e21760\n")
	fmt.Printf("Hash matches DB: %t\n", hashStr == "25e9bab255898532d470c0259bf609dd86f6d80fed5f401bdc36504f355abde9")
}
