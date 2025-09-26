package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mimbackend/config"
	auth "mimbackend/internal/models/auth"
	"net/http"
	"net/url"
	"os"
	"strings"
)

type OAuthToken struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type GoogleUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

type FacebookUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	} `json:"picture"`
}

type GithubUserInfo struct {
	ID        int    `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

// ExchangeGoogleCode Google authorization code'u access token'a çevirir
func ExchangeGoogleCode(code string) (*OAuthToken, error) {
	data := url.Values{}
	data.Set("client_id", os.Getenv("GOOGLE_CLIENT_ID"))
	data.Set("client_secret", os.Getenv("GOOGLE_CLIENT_SECRET"))
	data.Set("code", code)
	data.Set("grant_type", "authorization_code")
	redirect := os.Getenv("GOOGLE_REDIRECT_URI")
	if redirect == "" {
		base := os.Getenv("BASE_URL")
		if base == "" {
			base = "http://localhost:3333"
		}
		apiPrefix := os.Getenv("API_PREFIX")
		if apiPrefix == "" {
			apiPrefix = "/api/v1"
		}
		redirect = strings.TrimRight(base, "/") + apiPrefix + "/auth/google/callback"
	}
	data.Set("redirect_uri", redirect)

	req, err := http.NewRequest("POST", "https://oauth2.googleapis.com/token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to exchange code")
	}

	var token OAuthToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, err
	}

	return &token, nil
}

// GetGoogleUserInfo Google access token ile user bilgilerini alır
func GetGoogleUserInfo(accessToken string) (*GoogleUserInfo, error) {
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get user info")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("Google userinfo response: %s", string(body))

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

// ExchangeFacebookCode Facebook authorization code'u access token'a çevirir
func ExchangeFacebookCode(code string) (*OAuthToken, error) {
	params := url.Values{}
	params.Set("client_id", os.Getenv("FACEBOOK_CLIENT_ID"))
	params.Set("client_secret", os.Getenv("FACEBOOK_CLIENT_SECRET"))
	params.Set("code", code)
	fbRedirect := os.Getenv("FACEBOOK_REDIRECT_URI")
	if fbRedirect == "" {
		base := os.Getenv("BASE_URL")
		if base == "" {
			base = "http://localhost:3333"
		}
		apiPrefix := os.Getenv("API_PREFIX")
		if apiPrefix == "" {
			apiPrefix = "/api/v1"
		}
		fbRedirect = strings.TrimRight(base, "/") + apiPrefix + "/auth/facebook/callback"
	}
	params.Set("redirect_uri", fbRedirect)

	resp, err := http.Get("https://graph.facebook.com/v18.0/oauth/access_token?" + params.Encode())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to exchange code")
	}

	var token OAuthToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, err
	}

	return &token, nil
}

// GetFacebookUserInfo Facebook access token ile user bilgilerini alır
func GetFacebookUserInfo(accessToken string) (*FacebookUserInfo, error) {
	resp, err := http.Get("https://graph.facebook.com/me?fields=id,email,name,picture&access_token=" + accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get user info")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("Facebook userinfo response: %s", string(body))

	var userInfo FacebookUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

// ExchangeGithubCode Github authorization code'u access token'a çevirir
func ExchangeGithubCode(code string) (*OAuthToken, error) {
	data := url.Values{}
	data.Set("client_id", os.Getenv("GITHUB_CLIENT_ID"))
	data.Set("client_secret", os.Getenv("GITHUB_CLIENT_SECRET"))
	data.Set("code", code)
	ghRedirect := os.Getenv("GITHUB_REDIRECT_URI")
	if ghRedirect == "" {
		base := os.Getenv("BASE_URL")
		if base == "" {
			base = "http://localhost:3333"
		}
		apiPrefix := os.Getenv("API_PREFIX")
		if apiPrefix == "" {
			apiPrefix = "/api/v1"
		}
		ghRedirect = strings.TrimRight(base, "/") + apiPrefix + "/auth/github/callback"
	}
	data.Set("redirect_uri", ghRedirect)

	req, err := http.NewRequest("POST", "https://github.com/login/oauth/access_token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to exchange code: %s", string(body))
	}

	var token OAuthToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, err
	}

	return &token, nil
}

// GetGithubUserInfo Github access token ile user bilgilerini alır
func GetGithubUserInfo(accessToken string) (*GithubUserInfo, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get user info")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("Github userinfo response: %s", string(body))

	var userInfo GithubUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	// Eğer name boşsa login kullan
	if userInfo.Name == "" {
		userInfo.Name = userInfo.Login
	}

	// Email bilgisini almak için ayrı istek
	if userInfo.Email == "" {
		emailReq, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
		if err != nil {
			return nil, err
		}

		emailReq.Header.Set("Authorization", "Bearer "+accessToken)
		emailReq.Header.Set("Accept", "application/vnd.github.v3+json")

		emailResp, err := client.Do(emailReq)
		if err != nil {
			return nil, err
		}
		defer emailResp.Body.Close()

		if emailResp.StatusCode == http.StatusOK {
			var emails []struct {
				Email    string `json:"email"`
				Primary  bool   `json:"primary"`
				Verified bool   `json:"verified"`
			}

			if err := json.NewDecoder(emailResp.Body).Decode(&emails); err == nil {
				for _, email := range emails {
					if email.Primary && email.Verified {
						userInfo.Email = email.Email
						break
					}
				}
			}
		}
	}

	return &userInfo, nil
}

// FindOrCreateOAuthUser OAuth provider'dan gelen kullanıcıyı bulur veya oluşturur
func FindOrCreateOAuthUser(provider, providerID, email, name, imageURL string) (*auth.User, error) {
	log.Printf("FindOrCreateOAuthUser: provider=%s, providerID=%s, email=%s, name=%s, imageURL=%s", provider, providerID, email, name, imageURL)
	db, err := config.NewConnection()
	if err != nil {
		return nil, err
	}

	// Önce account'u kontrol et
	var account auth.Account
	err = db.Where("provider = ? AND provider_id = ?", provider, providerID).First(&account).Error

	if err == nil {
		// Account bulundu, user'ı getir
		var user auth.User
		if err := db.First(&user, account.UserID).Error; err != nil {
			return nil, err
		}
		// ImageURL güncelle
		if imageURL != "" && (user.ImageURL == nil || *user.ImageURL != imageURL) {
			log.Printf("Updating existing OAuth user imageURL from %v to %s", user.ImageURL, imageURL)
			user.ImageURL = &imageURL
			if err := db.Save(&user).Error; err != nil {
				log.Printf("Failed to update user imageURL: %v", err)
				return nil, err
			}
			log.Printf("Updated user imageURL successfully")
		}
		return &user, nil
	}

	// Account bulunamadı, email ile user var mı kontrol et
	var existingUser auth.User
	if err := db.Where("email = ?", email).First(&existingUser).Error; err == nil {
		// User var, account oluştur
		account = auth.Account{
			UserID:     existingUser.ID,
			Provider:   provider,
			ProviderID: providerID,
		}
		if err := db.Create(&account).Error; err != nil {
			return nil, err
		}
		// IsVerified'i true yap
		if !existingUser.IsVerified {
			existingUser.IsVerified = true
			if err := db.Save(&existingUser).Error; err != nil {
				return nil, err
			}
		}
		// ImageURL ekle
		if imageURL != "" && (existingUser.ImageURL == nil || *existingUser.ImageURL == "" || *existingUser.ImageURL != imageURL) {
			log.Printf("Updating existing email user imageURL from %v to %s", existingUser.ImageURL, imageURL)
			existingUser.ImageURL = &imageURL
			if err := db.Save(&existingUser).Error; err != nil {
				log.Printf("Failed to update user imageURL: %v", err)
				return nil, err
			}
			log.Printf("Updated user imageURL successfully")
		}
		return &existingUser, nil
	}

	// Yeni user oluştur
	user := &auth.User{
		Email:      email,
		FullName:   &name,
		Role:       "user",
		IsVerified: true, // OAuth ile gelen kullanıcılar doğrulanmış kabul edilir
	}
	if imageURL != "" {
		user.ImageURL = &imageURL
	}

	if err := db.Create(user).Error; err != nil {
		return nil, err
	}

	// Account oluştur
	account = auth.Account{
		UserID:     user.ID,
		Provider:   provider,
		ProviderID: providerID,
	}

	if err := db.Create(&account).Error; err != nil {
		return nil, err
	}

	return user, nil
}
