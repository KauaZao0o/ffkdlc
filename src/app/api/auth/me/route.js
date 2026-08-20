import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest, clearAuthCookie } from "@/lib/auth";

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

// Apaga a própria conta (e, em cascata, suas mensagens/participações,
// graças ao onDelete: Cascade no schema). Pede a senha atual de novo por
// segurança - mesma exigência da troca de senha. A conta Ghost não pode se
// apagar por essa rota (ela não deveria sumir por engano).
export async function DELETE(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }
  if (user.isGhost) {
    return NextResponse.json({ error: "Essa conta não pode ser apagada por aqui." }, { status: 403 });
  }

  const { password } = await request.json();
  if (!password) {
    return NextResponse.json({ error: "Digite sua senha para confirmar." }, { status: 400 });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  await prisma.user.delete({ where: { id: userId } });

  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}
