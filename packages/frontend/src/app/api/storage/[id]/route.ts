import { NextRequest, NextResponse } from 'next/server'
import { storeSimulation, retrieveSimulation } from '@/lib/redis'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const data = await request.json()
    const resolvedParams = await params
    const success = await storeSimulation(resolvedParams.id, data)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Failed to store simulation' },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('Storage API error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params
    const data = await retrieveSimulation(resolvedParams.id)

    if (data) {
      return NextResponse.json({ simulation: data })
    } else {
      return NextResponse.json(
        { error: 'Simulation not found' },
        { status: 404 },
      )
    }
  } catch (error) {
    console.error('Retrieval API error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve simulation' },
      { status: 500 },
    )
  }
}
