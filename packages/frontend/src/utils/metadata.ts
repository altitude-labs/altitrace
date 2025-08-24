import type { Metadata } from 'next'

export interface SimulationMetadata {
  id: string
  title?: string
  gasUsed?: string
  status?: 'success' | 'failed'
  blockNumber?: string
  timestamp?: Date
}

export function generateSimulationMetadata(
  simulation: SimulationMetadata,
  baseUrl = 'https://altitrace.reachaltitude.xyz',
): Metadata {
  const title = simulation.title
    ? `${simulation.title} - Altitrace`
    : `Simulation ${simulation.id.slice(0, 8)} - Altitrace`

  const statusEmoji =
    simulation.status === 'success'
      ? '✅'
      : simulation.status === 'failed'
        ? '❌'
        : '🔄'

  const gasInfo = simulation.gasUsed
    ? ` (${Number(simulation.gasUsed).toLocaleString()} gas)`
    : ''

  const description = `${statusEmoji} HyperEVM Simulation${gasInfo}. Analyze transactions, gas usage, and call traces with Altitrace.`

  const url = `${baseUrl}/simulator/${simulation.id}`

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      siteName: 'Altitrace',
      title,
      description,
      images: [
        {
          url: `${baseUrl}/altitrace-embedded.png`,
          width: 1200,
          height: 630,
          alt: title,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@valtitudexyz',
      creator: '@quertyeth',
      title,
      description,
      images: [`${baseUrl}/altitrace-embedded.png`],
    },
    alternates: {
      canonical: url,
    },
  }
}

export function generateHomeMetadata(
  baseUrl = 'https://altitrace.reachaltitude.xyz',
): Metadata {
  return {
    title: 'Altitrace - HyperEVM Transaction Simulator by Altitude Labs',
    description:
      'Simulate, debug, and analyze EVM transactions within the HyperEVM network with precision and control. Professional tooling for developers.',
    keywords: [
      'HyperEVM',
      'Ethereum',
      'EVM',
      'Transaction Simulator',
      'Blockchain',
      'HyperEVM',
      'Altitude Labs',
      'Smart Contracts',
      'Gas Analysis',
      'Debugging',
      'Altitrace',
    ],
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: baseUrl,
      siteName: 'Altitrace',
      title: 'Altitrace - HyperEVM Transaction Simulator by Altitude Labs',
      description:
        'Simulate, debug, and analyze EVM transactions within the HyperEVM network with precision and control.',
      images: [
        {
          url: `${baseUrl}/altitrace-embedded.png`,
          width: 1200,
          height: 630,
          alt: 'Altitrace - Simulateur de Transactions HyperEVM',
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@valtitudexyz',
      creator: '@quertyeth',
      title: 'Altitrace - HyperEVM Transaction Simulator by Altitude Labs',
      description:
        'Simulate, debug, and analyze EVM transactions within the HyperEVM network with precision and control.',
      images: [`${baseUrl}/altitrace-embedded.png`],
    },
    alternates: {
      canonical: baseUrl,
    },
  }
}
