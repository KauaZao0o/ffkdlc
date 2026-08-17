import prisma from "./prisma";

// Sempre uma única linha (id 1) - cria com os padrões na primeira leitura
// se ainda não existir.
export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}
