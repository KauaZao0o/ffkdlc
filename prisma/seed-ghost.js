// Cria (ou atualiza a senha d)a conta admin oculta "Ghost". Rode com:
//   npm run seed:ghost
// Opcional: defina GHOST_PASSWORD no ambiente pra não deixar a senha
// hardcoded aqui.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const password = process.env.GHOST_PASSWORD || "1.77245385091";
  const passwordHash = await bcrypt.hash(password, 10);

  const ghost = await prisma.user.upsert({
    where: { username: "Ghost" },
    update: { passwordHash, isGhost: true },
    create: { username: "Ghost", passwordHash, isGhost: true, avatarColor: "blue" },
  });

  console.log(`Conta Ghost pronta (id: ${ghost.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
