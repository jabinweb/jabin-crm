import { NextRequest } from 'next/server';
import { z, ZodSchema } from 'zod';
import { ApiErrors } from '@/lib/api-error-handler';

/** Validate JSON request body against a Zod schema (throws {@link ApiErrors.badRequest}). */
export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      const err = ApiErrors.badRequest('Validation failed');
      err.details = { errors };
      throw err;
    }

    throw ApiErrors.badRequest('Invalid request body');
  }
}

/** Validate URL query parameters against a Zod schema. */
export function validateQuery<T>(request: NextRequest, schema: ZodSchema<T>): T {
  const { searchParams } = request.nextUrl;
  const params = Object.fromEntries(searchParams.entries());

  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      const err = ApiErrors.badRequest('Query validation failed');
      err.details = { errors };
      throw err;
    }

    throw ApiErrors.badRequest('Invalid query parameters');
  }
}

export const CommonSchemas = {
  pagination: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10)),
  }),

  email: z.string().email('Invalid email address'),
  id: z.string().min(1, 'ID is required'),

  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  search: z.object({
    q: z.string().min(1, 'Search query is required'),
  }),
};

export function sanitizeString(input: string): string {
  return input.replace(/[<>]/g, '').trim();
}

export function validateFile(
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
  } = {}
): void {
  const {
    maxSize = 5 * 1024 * 1024,
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
  } = options;

  if (file.size > maxSize) {
    throw ApiErrors.badRequest(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
  }

  if (!allowedTypes.includes(file.type)) {
    throw ApiErrors.badRequest(`File type ${file.type} is not allowed`);
  }
}

export function withRateLimit(limit: number, windowMs: number) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (identifier: string): boolean => {
    const now = Date.now();
    const record = requests.get(identifier);

    if (!record || now > record.resetTime) {
      requests.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= limit) {
      return false;
    }

    record.count++;
    return true;
  };
}
