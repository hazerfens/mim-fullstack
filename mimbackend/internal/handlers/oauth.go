package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"mimbackend/internal/services"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// OAuth state için basit in-memory store (production'da Redis kullanın)
var oauthStates = make(map[string]string)

// generateState rastgele state string oluşturur
func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// GoogleOAuthHandler Google OAuth başlatır
// @Summary Start Google OAuth
// @Description Redirects user to Google's OAuth consent screen
// @Tags Auth
// @Produce json
// @Router /auth/google [get]
func GoogleOAuthHandler(c *gin.Context) {
	state := generateState()
	oauthStates[state] = "google"

	// store state in cookie for client validation
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Expires:  time.Now().Add(5 * time.Minute),
	})

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
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

	// Google OAuth URL'i oluştur
	authURL := fmt.Sprintf(
		"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&scope=%s&response_type=code&state=%s",
		clientID,
		url.QueryEscape(redirect),
		"openid email profile",
		state,
	)

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// FacebookOAuthHandler Facebook OAuth başlatır
// @Summary Start Facebook OAuth
// @Description Redirects user to Facebook's OAuth consent screen
// @Tags Auth
// @Produce json
// @Router /auth/facebook [get]
func FacebookOAuthHandler(c *gin.Context) {
	state := generateState()
	oauthStates[state] = "facebook"

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Expires:  time.Now().Add(5 * time.Minute),
	})

	clientID := os.Getenv("FACEBOOK_CLIENT_ID")
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

	authURL := fmt.Sprintf(
		"https://www.facebook.com/v18.0/dialog/oauth?client_id=%s&redirect_uri=%s&scope=%s&response_type=code&state=%s",
		clientID,
		url.QueryEscape(fbRedirect),
		"email,public_profile",
		state,
	)

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// GithubOAuthHandler Github OAuth başlatır
// @Summary Start Github OAuth
// @Description Redirects user to Github's OAuth consent screen
// @Tags Auth
// @Produce json
// @Router /auth/github [get]
func GithubOAuthHandler(c *gin.Context) {
	state := generateState()
	oauthStates[state] = "github"

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Expires:  time.Now().Add(5 * time.Minute),
	})

	clientID := os.Getenv("GITHUB_CLIENT_ID")
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

	authURL := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=%s&state=%s",
		clientID,
		url.QueryEscape(ghRedirect),
		"user:email",
		state,
	)

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// GoogleCallbackHandler Google OAuth callback
// @Summary Google OAuth callback
// @Description Handles OAuth callback from Google and redirects to frontend
// @Tags Auth
// @Produce html
// @Param state query string true "State"
// @Param code query string true "Code"
// @Router /auth/google/callback [get]
func GoogleCallbackHandler(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	log.Printf("OAuth callback received for google: state=%q", state)

	// State doğrula: prefer cookie stored state (one per client)
	cookie, err := c.Request.Cookie("oauth_state")
	if err == nil {
		log.Printf("Found oauth_state cookie: %q", cookie.Value)
		if cookie.Value != state {
			log.Printf("Cookie/state mismatch: cookie=%q state=%q", cookie.Value, state)
			// mismatch
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state (cookie mismatch)"})
			return
		}
		// remove cookie
		http.SetCookie(c.Writer, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", Expires: time.Unix(0, 0)})
	} else {
		present := oauthStates[state]
		log.Printf("No cookie; oauthStates[%q]=%q", state, present)
		// fallback to in-memory map
		if oauthStates[state] != "google" {
			log.Printf("oauthStates check failed for state=%q, val=%q", state, oauthStates[state])
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state"})
			return
		}
		delete(oauthStates, state)
	}

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not provided"})
		return
	}

	// Google'dan access token al
	token, err := services.ExchangeGoogleCode(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code"})
		return
	}

	// Google'dan user info al
	userInfo, err := services.GetGoogleUserInfo(token.AccessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}

	log.Printf("Google userInfo: ID=%s, Email=%s, Name=%s, Picture=%s", userInfo.ID, userInfo.Email, userInfo.Name, userInfo.Picture)

	// Kullanıcıyı bul veya oluştur
	user, err := services.FindOrCreateOAuthUser("google", userInfo.ID, userInfo.Email, userInfo.Name, userInfo.Picture)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Generate access + refresh tokens
	accessTok, refreshTok, err := services.GenerateTokens(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Persist session & account
	refreshExp := time.Now().Add(30 * 24 * time.Hour)
	if err := services.CreateSession(user.ID, refreshTok, refreshExp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}
	if err := services.CreateAccount(user.ID, "google", userInfo.ID, accessTok, refreshTok, refreshExp.Unix()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	// Token'ları cookie olarak set et
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    accessTok,
		Path:     "/",
		HttpOnly: false, // Frontend'ten erişilebilir olsun
		Secure:   false, // Development için false
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600, // 1 saat
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshTok,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600, // 30 gün
	})

	// Send full payload to frontend URL (so frontend can process without tokens in URL)
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	payload := map[string]interface{}{
		"access_token":  accessTok,
		"refresh_token": refreshTok,
		"user": map[string]interface{}{
			"email":       user.Email,
			"full_name":   user.FullName,
			"role":        user.Role,
			"is_verified": user.IsVerified,
			"image_url":   user.ImageURL,
		},
	}

	if b, err := json.Marshal(payload); err == nil {
		// Best-effort server->server POST JSON to frontend API
		go func(data []byte) {
			client := &http.Client{Timeout: 5 * time.Second}
			req, _ := http.NewRequest("POST", strings.TrimRight(frontendURL, "/")+"/api/auth/callback", bytes.NewBuffer(data))
			req.Header.Set("Content-Type", "application/json")
			if resp, err := client.Do(req); err != nil {
				log.Printf("POST to frontend API failed: %v", err)
			} else {
				resp.Body.Close()
				log.Printf("Posted auth payload to frontend API: %s", frontendURL+"/api/auth/callback")
			}
		}(b)
	} else {
		log.Printf("Failed to marshal auth payload: %v", err)
	}

	c.Redirect(http.StatusFound, frontendURL+"/")
}

// FacebookCallbackHandler Facebook OAuth callback
// @Summary Facebook OAuth callback
// @Description Handles OAuth callback from Facebook and redirects to frontend
// @Tags Auth
// @Produce html
// @Param state query string true "State"
// @Param code query string true "Code"
// @Router /auth/facebook/callback [get]
func FacebookCallbackHandler(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	log.Printf("OAuth callback received for facebook: state=%q", state)

	cookie, err := c.Request.Cookie("oauth_state")
	if err == nil {
		log.Printf("Found oauth_state cookie: %q", cookie.Value)
		if cookie.Value != state {
			log.Printf("Cookie/state mismatch: cookie=%q state=%q", cookie.Value, state)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state (cookie mismatch)"})
			return
		}
		http.SetCookie(c.Writer, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", Expires: time.Unix(0, 0)})
	} else {
		log.Printf("No cookie; oauthStates[%q]=%q", state, oauthStates[state])
		if oauthStates[state] != "facebook" {
			log.Printf("oauthStates check failed for state=%q, val=%q", state, oauthStates[state])
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state"})
			return
		}
		delete(oauthStates, state)
	}

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not provided"})
		return
	}

	// Facebook'dan access token al
	token, err := services.ExchangeFacebookCode(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code"})
		return
	}

	// Facebook'dan user info al
	userInfo, err := services.GetFacebookUserInfo(token.AccessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}

	log.Printf("Facebook userInfo: ID=%s, Email=%s, Name=%s, Picture=%s", userInfo.ID, userInfo.Email, userInfo.Name, userInfo.Picture.Data.URL)

	// Kullanıcıyı bul veya oluştur
	user, err := services.FindOrCreateOAuthUser("facebook", userInfo.ID, userInfo.Email, userInfo.Name, userInfo.Picture.Data.URL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Generate access + refresh tokens
	accessTok, refreshTok, err := services.GenerateTokens(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	refreshExp := time.Now().Add(30 * 24 * time.Hour)
	if err := services.CreateSession(user.ID, refreshTok, refreshExp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}
	if err := services.CreateAccount(user.ID, "facebook", userInfo.ID, accessTok, refreshTok, refreshExp.Unix()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	// Token'ları cookie olarak set et
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    accessTok,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshTok,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})

	// Send full payload to frontend URL (best-effort)
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	payload := map[string]interface{}{
		"access_token":  accessTok,
		"refresh_token": refreshTok,
		"user": map[string]interface{}{
			"email":       user.Email,
			"full_name":   user.FullName,
			"role":        user.Role,
			"is_verified": user.IsVerified,
			"image_url":   user.ImageURL,
		},
	}

	if b, err := json.Marshal(payload); err == nil {
		go func(data []byte) {
			client := &http.Client{Timeout: 5 * time.Second}
			req, _ := http.NewRequest("POST", strings.TrimRight(frontendURL, "/")+"/api/auth/callback", bytes.NewBuffer(data))
			req.Header.Set("Content-Type", "application/json")
			if resp, err := client.Do(req); err != nil {
				log.Printf("POST to frontend API failed: %v", err)
			} else {
				resp.Body.Close()
				log.Printf("Posted auth payload to frontend API: %s", frontendURL+"/api/auth/callback")
			}
		}(b)
	} else {
		log.Printf("Failed to marshal auth payload: %v", err)
	}

	c.Redirect(http.StatusFound, frontendURL+"/")
}

// GithubCallbackHandler Github OAuth callback
// @Summary Github OAuth callback
// @Description Handles OAuth callback from Github and redirects to frontend
// @Tags Auth
// @Produce html
// @Param state query string true "State"
// @Param code query string true "Code"
// @Router /auth/github/callback [get]
func GithubCallbackHandler(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	log.Printf("OAuth callback received for github: state=%q", state)

	cookie, err := c.Request.Cookie("oauth_state")
	if err == nil {
		log.Printf("Found oauth_state cookie: %q", cookie.Value)
		if cookie.Value != state {
			log.Printf("Cookie/state mismatch: cookie=%q state=%q", cookie.Value, state)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state (cookie mismatch)"})
			return
		}
		http.SetCookie(c.Writer, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", Expires: time.Unix(0, 0)})
	} else {
		log.Printf("No cookie; oauthStates[%q]=%q", state, oauthStates[state])
		if oauthStates[state] != "github" {
			log.Printf("oauthStates check failed for state=%q, val=%q", state, oauthStates[state])
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state"})
			return
		}
		delete(oauthStates, state)
	}

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not provided"})
		return
	}

	// Github'dan access token al
	token, err := services.ExchangeGithubCode(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code"})
		return
	}

	// Github'dan user info al
	userInfo, err := services.GetGithubUserInfo(token.AccessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}

	log.Printf("Github userInfo: ID=%d, Email=%s, Name=%s, AvatarURL=%s", userInfo.ID, userInfo.Email, userInfo.Name, userInfo.AvatarURL)

	// Kullanıcıyı bul veya oluştur
	user, err := services.FindOrCreateOAuthUser("github", strconv.Itoa(userInfo.ID), userInfo.Email, userInfo.Name, userInfo.AvatarURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Generate access + refresh tokens
	accessTok, refreshTok, err := services.GenerateTokens(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	refreshExp := time.Now().Add(30 * 24 * time.Hour)
	if err := services.CreateSession(user.ID, refreshTok, refreshExp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}
	if err := services.CreateAccount(user.ID, "github", strconv.Itoa(userInfo.ID), accessTok, refreshTok, refreshExp.Unix()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	// Token'ları cookie olarak set et
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    accessTok,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   3600,
	})

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshTok,
		Path:     "/",
		HttpOnly: false,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})

	// Send full payload to frontend URL (best-effort)
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	payload := map[string]interface{}{
		"access_token":  accessTok,
		"refresh_token": refreshTok,
		"user": map[string]interface{}{
			"email":       user.Email,
			"full_name":   user.FullName,
			"role":        user.Role,
			"is_verified": user.IsVerified,
			"image_url":   user.ImageURL,
		},
	}

	if b, err := json.Marshal(payload); err == nil {
		go func(data []byte) {
			client := &http.Client{Timeout: 5 * time.Second}
			req, _ := http.NewRequest("POST", strings.TrimRight(frontendURL, "/")+"/api/auth/callback", bytes.NewBuffer(data))
			req.Header.Set("Content-Type", "application/json")
			if resp, err := client.Do(req); err != nil {
				log.Printf("POST to frontend API failed: %v", err)
			} else {
				resp.Body.Close()
				log.Printf("Posted auth payload to frontend API: %s", frontendURL+"/api/auth/callback")
			}
		}(b)
	} else {
		log.Printf("Failed to marshal auth payload: %v", err)
	}

	c.Redirect(http.StatusFound, frontendURL+"/")
}
