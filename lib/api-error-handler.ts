import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logError } from './logger';

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: any;
}

/**
 * Standardized API error handler
 * Converts various error types into consistent JSON responses
 */
export function handleApiError(error: unknown, context?: Record<string, any>): NextResponse {
  // Log the error
  logError(error, context);

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      },
      { status: 400 }
    );
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'A record with this information already exists',
          code: 'DUPLICATE_RECORD',
          details: error.meta,
        },
        { status: 409 }
      );
    }

    // Foreign key constraint violation
    if (error.code === 'P2003') {
      return NextResponse.json(
        {
          error: 'Referenced record not found',
          code: 'INVALID_REFERENCE',
        },
        { status: 400 }
      );
    }

    // Record not found
    if (error.code === 'P2025') {
      return NextResponse.json(
        {
          error: 'Record not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Generic Prisma error
    return NextResponse.json(
      {
        error: 'Database operation failed',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        error: 'Invalid data provided',
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    );
  }

  // Custom API errors
  if (error instanceof Error && 'statusCode' in error) {
    const apiError = error as ApiError;
    return NextResponse.json(
      {
        error: apiError.message,
        code: apiError.code || 'API_ERROR',
        details: apiError.details,
      },
      { status: apiError.statusCode || 500 }
    );
  }

  // Standard Error
  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message;

    return NextResponse.json(
      {
        error: message,
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }

  // Unknown error type
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    },
    { status: 500 }
  );
}

/**
 * Create a custom API error
 */
export class ApiException extends Error implements ApiError {
  statusCode: number;
  code?: string;
  details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'ApiException';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Common API errors
 */
export const ApiErrors = {
  unauthorized: () => new ApiException('Unauthorized', 401, 'UNAUTHORIZED'),
  forbidden: (message?: string) =>
    new ApiException(message || 'Forbidden', 403, 'FORBIDDEN'),
  notFound: (resource?: string) =>
    new ApiException(
      resource ? `${resource} not found` : 'Resource not found',
      404,
      'NOT_FOUND'
    ),
  badRequest: (message: string) => new ApiException(message, 400, 'BAD_REQUEST'),
  conflict: (message: string) => new ApiException(message, 409, 'CONFLICT'),
  tooManyRequests: () =>
    new ApiException('Too many requests', 429, 'RATE_LIMIT_EXCEEDED'),
  internal: (message?: string) =>
    new ApiException(message || 'Internal server error', 500, 'INTERNAL_ERROR'),
};

