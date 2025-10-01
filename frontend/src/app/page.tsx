'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Image from "next/image";

export default function Home() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    const message = searchParams.get('message')

    if (error === 'unauthorized' && message) {
      toast.error(message, {
        description: 'Bu sayfaya erişim yetkiniz bulunmamaktadır',
      })
    }
  }, [searchParams])

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-8 row-start-2 items-center">
        
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">MimReklam</h1>
          <p className="text-lg text-muted-foreground">
            Mim Reklam yönetim sistemi
          </p>
        </div>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="/auth/login"
          >
            Giriş Yap
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="/auth/register"
          >
            Kayıt Ol
          </a>
        </div>
      </main>

      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <p className="text-sm text-muted-foreground">
          © 2025 MimReklam. Tüm hakları saklıdır.
        </p>
      </footer>
    </div>
  );
}
