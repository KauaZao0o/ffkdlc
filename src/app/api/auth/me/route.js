import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl,
    isGhost: user.isGhost,
  });
}

// Atualiza o perfil: nome de usuário e/ou foto. Os dois campos são
// opcionais - manda só o que quiser mudar.
export async function PATCH(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { username, avatarUrl } = await request.json();
  const data = {};

  if (username !== undefined) {
    if (!username.trim()) {
      return NextResponse.json({ error: "O nome de usuário não pode ficar vazio." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: "Esse nome de usuário já está em uso." }, { status: 409 });
    }

    data.username = username;
  }

  if (avatarUrl !== undefined) {
    data.avatarUrl = avatarUrl;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id: userId }, data });

  return NextResponse.json({
    id: user.id,
    username: user.username,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl,
  });
}
