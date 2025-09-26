package services

import (
	"bytes"
	"fmt"
	"html/template"
	"net/smtp"
	"os"
)

// EmailService struct for email operations
type EmailService struct {
	frontendURL string
}

// NewEmailService creates a new email service instance
func NewEmailService() *EmailService {
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000" // default
	}
	return &EmailService{
		frontendURL: frontendURL,
	}
}

// getSMTPConfig gets SMTP configuration from environment
func (s *EmailService) getSMTPConfig() (host, port, user, pass, from string) {
	host = os.Getenv("SMTP_HOST")
	port = os.Getenv("SMTP_PORT")
	user = os.Getenv("SMTP_USERNAME")   // .env'deki SMTP_USERNAME kullan
	pass = os.Getenv("SMTP_PASSWORD")   // .env'deki SMTP_PASSWORD kullan
	from = os.Getenv("SMTP_FROM_EMAIL") // .env'deki SMTP_FROM_EMAIL kullan
	return
}

// sendEmail sends email using SMTP
func (s *EmailService) sendEmail(to, subject, htmlBody string) error {
	host, port, user, pass, from := s.getSMTPConfig()

	// Development fallback
	if host == "" || port == "" {
		if os.Getenv("ENV") == "development" {
			fmt.Printf("[DEV] Email to %s\nSubject: %s\nBody: %s\n", to, subject, htmlBody)
			return nil
		}
		return fmt.Errorf("smtp config not provided")
	}

	msg := "MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n" +
		"From: " + from + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n\r\n" + htmlBody

	addr := host + ":" + port
	auth := smtp.PlainAuth("", user, pass, host)
	if err := smtp.SendMail(addr, auth, from, []string{to}, []byte(msg)); err != nil {
		return err
	}

	return nil
}

// SendVerificationEmail sends email verification code to user
func (s *EmailService) SendVerificationEmail(to, userName, verificationCode string) error {
	subject := "Email Doğrulama Kodu - MimReklam"

	// load template from filesystem
	tmpl, err := template.ParseFiles("templates/verification.html")
	if err != nil {
		return fmt.Errorf("failed to load email template: %w", err)
	}

	data := struct {
		UserName         string
		VerificationCode string
		VerificationURL  string
	}{
		UserName:         userName,
		VerificationCode: verificationCode,
		VerificationURL:  s.frontendURL + "/verify-email?code=" + verificationCode,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return fmt.Errorf("failed to render email template: %w", err)
	}

	return s.sendEmail(to, subject, buf.String())
}

// SendPasswordResetEmail sends password reset email to user
func (s *EmailService) SendPasswordResetEmail(to string, userName *string, resetURL string) error {
	subject := "Şifre Sıfırlama - MimReklam"

	// load template from filesystem
	tmpl, err := template.ParseFiles("templates/password_reset.html")
	if err != nil {
		return fmt.Errorf("failed to load password reset template: %w", err)
	}

	name := "Kullanıcı"
	if userName != nil && *userName != "" {
		name = *userName
	}

	data := struct {
		UserName string
		ResetURL string
	}{
		UserName: name,
		ResetURL: resetURL,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return fmt.Errorf("failed to render password reset template: %w", err)
	}

	return s.sendEmail(to, subject, buf.String())
}
