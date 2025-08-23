import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Simulator - Altitrace',
  description: 'Manage and execute your HyperEVM transaction simulations. Create, share and analyze your smart contract tests.',
  openGraph: {
    title: 'Transaction Simulator - Altitrace',
    description: 'Manage and execute your HyperEVM transaction simulations.',
    images: ['/banner.png'],
    url: 'https://altitrace.reachaltitude.xyz/simulator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Transaction Simulator - Altitrace',
    description: 'Manage and execute your HyperEVM transaction simulations.',
    images: ['/banner.png'],
  },
}

export default function SimulatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
