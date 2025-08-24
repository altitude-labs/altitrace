import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppLayout } from '@/components/layout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Altitrace - HyperEVM Transaction Simulator',
  description:
    'Simulate, debug, and analyze EVM transactions within the HyperEVM network with precision and control. Professional tooling for developers.',
  keywords: [
    'HyperEVM',
    'Ethereum',
    'EVM',
    'Transaction Simulator',
    'Blockchain',
    'Smart Contracts',
    'Gas Analysis',
    'Debugging',
    'Altitrace',
  ],
  authors: [{ name: 'Altitrace Team' }],
  creator: 'Altitrace',
  publisher: 'Altitrace',

  // Open Graph metadata for social sharing
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://altitrace.reachaltitude.xyz',
    siteName: 'Altitrace',
    title: 'Altitrace - HyperEVM Transaction Simulator',
    description:
      'Simulate, debug, and analyze EVM transactions within the HyperEVM network with precision and control. Professional tooling for developers.',
    images: [
      {
        url: 'https://altitrace.reachaltitude.xyz/altitrace-embedded.png',
        width: 1200,
        height: 630,
        alt: 'Altitrace - HyperEVM Transaction Simulator',
        type: 'image/png',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    site: '@valtitudexyz',
    creator: '@quertyeth',
    title: 'Altitrace - HyperEVM Transaction Simulator',
    description:
      'Simulate, debug, and analyze EVM transactions within the HyperEVM network with precision and control.',
    images: ['https://altitrace.reachaltitude.xyz/altitrace-embedded.png'],
  },

  icons: {
    icon: [{ url: '/favicon.ico', sizes: '32x32' }],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },

  manifest: '/site.webmanifest',
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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  )
}
