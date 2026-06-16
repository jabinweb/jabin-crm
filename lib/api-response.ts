import { NextResponse } from "next/server"

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export function createApiResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    data,
    success: true,
    message,
  }
}

export function createErrorResponse(error: string | Error, status = 500): NextResponse {
  const message = error instanceof Error ? error.message : error
  console.error(`API Error: ${message}`)
  
  return NextResponse.json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? error : undefined
  }, { status })
}

