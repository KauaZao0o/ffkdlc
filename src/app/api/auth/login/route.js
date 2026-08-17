import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken, setAuthCookie } from "@/lib/auth";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
    }

    const token = generateToken(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        isGhost: user.isGhost,
      },
    });
    setAuthCookie(response, token);
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao fazer login." }, { status: 500 });
  }
}
