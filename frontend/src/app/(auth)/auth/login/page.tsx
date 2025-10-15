import { LoginForm } from '@/features/components/auth/login-form';
import React from 'react';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş Yap",
  description: "Mim Reklam yönetim paneline giriş yapın. E-posta ve şifreniz ile hesabınıza erişin.",
};

const LoginPage = async () => {

  return (
    <div><LoginForm /></div>
  )
}

export default LoginPage