/**
 * RPC Proxy API Route - Proxies viem RPC requests to avoid CORS issues
 */

import { NextRequest, NextResponse } from 'next/server'

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.hyperliquid.xyz/evm'

export async function POST(request: NextRequest) {
  try {
    // Parse the JSON-RPC request from viem
    const body = await request.json()

    // Forward the request to the actual RPC endpoint
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any additional headers your RPC endpoint might need
        ...(process.env.RPC_AUTH_HEADER && {
          Authorization: process.env.RPC_AUTH_HEADER,
        }),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `RPC request failed: ${response.statusText}` },
        { status: response.status },
      )
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'RPC proxy error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

// Support CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
