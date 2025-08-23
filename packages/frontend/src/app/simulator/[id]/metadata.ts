import type { Metadata } from 'next'
import { generateSimulationMetadata } from '@/utils/metadata'
import { retrieveById } from '@/utils/storage'

interface Props {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params
  const simulation = retrieveById(resolvedParams.id)

  if (!simulation) {
    return {
      title: 'Simulation Not Found - Altitrace',
      description: 'This simulation does not exist or has been deleted.',
    }
  }

  return generateSimulationMetadata({
    id: simulation.id,
    title: simulation.metadata?.title,
    timestamp: simulation.timestamp,
  })
}
