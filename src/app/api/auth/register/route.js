import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken, setAuthCookie } from "@/lib/auth";

const AVATAR_COLORS = ["blue", "teal", "coral", "pink", "purple", "amber", "green"];

function pickAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Usuário e senha são obrigatórios." }, { status: 400 });
    }

    if (username.trim().toLowerCase() === "ghost") {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, passwordHash, avatarColor: pickAvatarColor() },
    });

    const token = generateToken(user.id);

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl },
    });
    setAuthCookie(response, token);
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao registrar usuário." }, { status: 500 });
  }
}
