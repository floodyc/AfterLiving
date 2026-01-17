import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  });

if (!isProduction) {
  global.prisma = prisma;
}

export * from '@prisma/client';
export { PrismaClient };
