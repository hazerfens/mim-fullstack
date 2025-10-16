import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
// import { getAllCompaniesForAdminAction } from '@/features/actions/company-action';
import { getCurrentUserAction } from "@/features/actions/auth-action";
import { cookies } from 'next/headers';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Mim Reklam - Profesyonel Reklam ve Baskı Hizmetleri",
    template: "%s | Mim Reklam"
  },
  description: "Mim Reklam ile profesyonel baskı, reklam ve tasarım hizmetleri. Yüksek kaliteli baskı ürünleri, outdoor reklam, iç mekan dizaynı ve dijital çözümler sunuyoruz.",
  keywords: ["reklam", "baskı", "outdoor reklam", "iç mekan dizaynı", "dijital baskı", "profesyonel baskı", "Mim Reklam"],
  authors: [{ name: "Mim Reklam" }],
  creator: "Mim Reklam",
  publisher: "Mim Reklam",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'http://localhost:3000',
    title: 'Mim Reklam - Profesyonel Reklam ve Baskı Hizmetleri',
    description: 'Mim Reklam ile profesyonel baskı, reklam ve tasarım hizmetleri. Yüksek kaliteli baskı ürünleri, outdoor reklam, iç mekan dizaynı ve dijital çözümler.',
    siteName: 'Mim Reklam',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Mim Reklam - Profesyonel Reklam Hizmetleri',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mim Reklam - Profesyonel Reklam ve Baskı Hizmetleri',
    description: 'Mim Reklam ile profesyonel baskı, reklam ve tasarım hizmetleri.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-site-verification-code',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get user session for all routes
  const { status, user } = await getCurrentUserAction();

  const initialUser = status === "success" ? user : null;

  // Read initial companies snapshot and active company from auth route
  // cookies when available. This avoids an extra client-side fetch and
  // hydrates the company store with server-side data.
  let initialCompanies = null;
  let initialActiveCompany = null;
  try {
    const cookieStore = await cookies();
    const rawCompanies = cookieStore.get('initialCompanies')?.value ?? null;
    const rawActive = cookieStore.get('initialActiveCompany')?.value ?? null;
    if (rawCompanies) {
      try { initialCompanies = JSON.parse(rawCompanies); } catch {}
    }
    if (rawActive) {
      try { initialActiveCompany = JSON.parse(rawActive); } catch {}
    }
  } catch {}

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <SessionProvider
            initialUser={initialUser}
            initialCompanies={initialCompanies}
            initialActiveCompany={initialActiveCompany}
          >
            {children}
          </SessionProvider>
        </ThemeProvider>
        <Toaster position="bottom-right" richColors={false} />
      </body>
    </html>
  );
}
