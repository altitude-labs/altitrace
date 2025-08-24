import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'New Simulation - Altitrace',
  description:
    'Create a new HyperEVM transaction simulation. Import your ABI, configure parameters and test your smart contracts.',
  openGraph: {
    title: 'New Simulation - Altitrace',
    description: 'Create a new HyperEVM transaction simulation.',
    images: ['/altitrace-embedded.png'],
    url: 'https://altitrace.reachaltitude.xyz/simulator/new',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'New Simulation - Altitrace',
    description: 'Create a new HyperEVM transaction simulation.',
    images: ['/altitrace-embedded.png'],
  },
}

export default function NewSimulationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
