import { LoginForm } from '@/features/components/auth/login-form';
import { getServerSession, getUserProfile } from '@/lib/auth';
import React from 'react'

const LoginPage = async () => {

  return (
    <div><LoginForm /></div>
  )
}

export default LoginPage