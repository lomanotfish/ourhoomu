import { DataError } from '../../db/connection';
export function fields(
  body: unknown,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new DataError('validation_error');
  const result = body as Record<string, unknown>;
  if (
    required.some((key) => !Object.hasOwn(result, key)) ||
    Object.keys(result).some((key) => ![...required, ...optional].includes(key))
  )
    throw new DataError('validation_error');
  return result;
}
export function text(value: unknown, max = 200, min = 1): string {
  if (typeof value !== 'string' || value.length < min || value.length > max || !value.trim())
    throw new DataError('validation_error');
  return value;
}
export function uuid(value: unknown): string {
  const result = text(value, 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result))
    throw new DataError('validation_error');
  return result;
}
export function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > max)
    throw new DataError('validation_error');
  return value;
}
