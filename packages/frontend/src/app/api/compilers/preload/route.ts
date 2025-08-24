import { type NextRequest, NextResponse } from 'next/server'
import { getPreloadStatus, preloadCompilers } from '@/lib/compiler-preload'

export async function POST(_request: NextRequest) {
  try {

    await preloadCompilers()

    const status = getPreloadStatus()

    return NextResponse.json({
      success: true,
      message: 'Compiler preloading completed',
      ...status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET(_request: NextRequest) {
  try {
    const status = getPreloadStatus()

    return NextResponse.json({
      success: true,
      ...status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
