import { describe, test, expect, beforeAll } from '@jest/globals';
import { ApiErrors, ApiException } from '../api-error-handler';

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init: any) => ({ data, status: init?.status || 200 }),
  },
}));

describe('API Error Handler', () => {
  test('ApiException should create error with correct properties', () => {
    const error = new ApiException('Test error', 400, 'TEST_ERROR', { field: 'email' });
    
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toEqual({ field: 'email' });
  });

  test('ApiErrors.unauthorized should return 401', () => {
    const error = ApiErrors.unauthorized();
    
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  test('ApiErrors.forbidden should return 403', () => {
    const error = ApiErrors.forbidden();
    
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  test('ApiErrors.notFound should return 404', () => {
    const error = ApiErrors.notFound('User');
    
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('User not found');
  });

  test('ApiErrors.badRequest should return 400', () => {
    const error = ApiErrors.badRequest('Invalid email');
    
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid email');
  });

  test('ApiErrors.conflict should return 409', () => {
    const error = ApiErrors.conflict('Email already exists');
    
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  test('ApiErrors.tooManyRequests should return 429', () => {
    const error = ApiErrors.tooManyRequests();
    
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  test('ApiErrors.internal should return 500', () => {
    const error = ApiErrors.internal('Database connection failed');
    
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});

