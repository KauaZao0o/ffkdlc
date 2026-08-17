import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireGhost } from "@/lib/auth";

// Troca o nome de usuário e/ou a senha de qualquer usuário. Só a conta
// Ghost tem acesso.
export async function PATCH(request, { params }) {
  const { response } = await requireGhost(request);
  if (response) return response;

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target || target.isGhost) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const { username, password } = await request.json();
  const data = {};

  if (username !== undefined) {
    const trimmed = username.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "O nome de usuário não pode ficar vazio." }, { status: 400 });
    }
    if (trimmed.toLowerCase() === "ghost") {
      return NextResponse.json({ error: "Esse nome de usuário já está em uso." }, { status: 409 });
    }
    const existing = await prisma.user.findUnique({ where: { username: trimmed } });
    if (existing && existing.id !== params.id) {
      return NextResponse.json({ error: "Esse nome de usuário já está em uso." }, { status: 409 });
    }
    data.username = trimmed;
  }

  if (password !== undefined) {
    if (!password) {
      return NextResponse.json({ error: "Senha inválida." }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data });

  return NextResponse.json({ id: updated.id, username: updated.username });
}

// Apaga qualquer usuário (e em cascata suas mensagens e participações,
// graças ao onDelete: Cascade no schema). Só a conta Ghost tem acesso.
export async function DELETE(request, { params }) {
  const { response } = await requireGhost(request);
  if (response) return response;

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target || target.isGhost) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
