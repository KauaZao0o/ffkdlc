import { PrismaClient } from "@prisma/client";

// Evita criar uma nova conexão a cada hot-reload em desenvolvimento.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
