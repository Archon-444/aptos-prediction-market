import type { Prisma } from '@prisma/client';

type Serializable =
  | string
  | number
  | boolean
  | null
  | Date
  | Serializable[]
  | { [key: string]: Serializable };

const isDecimal = (value: unknown): value is Prisma.Decimal => {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.constructor &&
    value.constructor.name === 'Decimal'
  );
};

export function toSerializable<T>(input: T): Serializable | T {
  if (input === null || input === undefined) {
    return input as T;
  }

  if (typeof input === 'bigint') {
    return input.toString();
  }

  if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'string') {
    return input;
  }

  if (isDecimal(input)) {
    return input.toString();
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  if (Array.isArray(input)) {
    return input.map((item) => toSerializable(item)) as Serializable;
  }

  if (typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      toSerializable(value),
    ]);
    return Object.fromEntries(entries) as Serializable;
  }

  return input as T;
}
