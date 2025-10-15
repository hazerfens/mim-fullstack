import { RegisterForm } from '@/features/components/auth/register-form'
import React from 'react'
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kayıt Ol",
  description: "Mim Reklam yönetim paneline yeni hesap oluşturun. Ücretsiz kayıt olarak başlayın.",
};

const RegisterPage = () => {
  return (<RegisterForm />)
}

export default RegisterPage