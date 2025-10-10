'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import InlineAlert from '@/components/ui/inline-alert'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export const EmailVerifyForm: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const verifyEmail = async () => {
      const code = searchParams.get('code')
      const email = searchParams.get('email')

      if (!code || !email) {
        setStatus('error')
        setMessage('Doğrulama kodu ve email bulunamadı.')
        return
      }

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            email,
          }),
        })

        const data = await response.json()

        if (response.ok) {
          setStatus('success')
          setMessage(data.message || 'Email başarıyla doğrulandı!')
          // 3 saniye sonra login sayfasına yönlendir
          setTimeout(() => {
            router.push('/auth/login')
          }, 3000)
        } else {
          setStatus('error')
          setMessage(data.error || 'Doğrulama başarısız oldu.')
        }
      } catch (error) {
        console.error('Email verification error:', error)
        setStatus('error')
        setMessage('Bir hata oluştu. Lütfen tekrar deneyin.')
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <div className="w-full max-w-md space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
            Email Doğrulama
          </CardTitle>
          <CardDescription>
            Email adresinizi doğruluyoruz...
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="text-center py-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Doğrulama işlemi devam ediyor...</p>
            </div>
          )}

          {status === 'success' && (
            <InlineAlert
              className="border-green-200 bg-green-50"
              icon={<CheckCircle className="h-4 w-4 text-green-600" />}
              description={
                <>
                  {message}
                  <br />
                  <span className="text-sm">3 saniye içinde giriş sayfasına yönlendirileceksiniz...</span>
                </>
              }
            />
          )}

          {status === 'error' && (
            <InlineAlert
              variant="destructive"
              icon={<XCircle className="h-4 w-4" />}
              description={message}
            />
          )}

          {status === 'error' && (
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push('/auth/login')}
              >
                Giriş Yap
              </Button>
              <Button
                className="flex-1"
                onClick={() => window.location.reload()}
              >
                Tekrar Dene
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}