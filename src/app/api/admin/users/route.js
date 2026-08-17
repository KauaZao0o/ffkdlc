import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireGhost } from "@/lib/auth";

const AVATAR_COLORS = ["blue", "teal", "coral", "pink", "purple", "amber", "green"];

function pickAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Lista todos os usuários do sistema. Só a conta Ghost tem acesso.
export async function GET(request) {
  const { response } = await requireGhost(request);
  if (response) return response;

  const users = await prisma.user.findMany({
    where: { isGhost: false },
    select: { id: true, username: true, avatarColor: true, avatarUrl: true, isOnline: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

// Cria um usuário diretamente, sem passar pelo /register - funciona mesmo
// com o cadastro público desativado. Só a conta Ghost tem acesso.
export async function POST(request) {
  const { response } = await requireGhost(request);
  if (response) return response;

  const { username, password } = await request.json();
  if (!username?.trim() || !password) {
    return NextResponse.json({ error: "Usuário e senha são obrigatórios." }, { status: 400 });
  }

  const trimmed = username.trim();
  if (trimmed.toLowerCase() === "ghost") {
    return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
  }

  const existing = await prisma.user.findUnique({ where: { username: trimmed } });
  if (existing) {
    return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username: trimmed, passwordHash, avatarColor: pickAvatarColor() },
  });

  return NextResponse.json({ id: user.id, username: user.username }, { status: 201 });
}
