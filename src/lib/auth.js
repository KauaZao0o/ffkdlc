import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import prisma from "./prisma";

const COOKIE_NAME = "token";

export function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Lê o userId a partir do cookie httpOnly da requisição (App Router).
export function getUserIdFromRequest(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  return payload?.userId || null;
}

// Configura o cookie de sessão numa resposta (NextResponse).
export function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

export function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function isGhostUser(userId) {
  if (!userId) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGhost: true } });
  return !!user?.isGhost;
}

// Usado pelas rotas /api/admin/*: exige que o usuário logado seja a conta
// Ghost. Retorna { userId } se autorizado, ou { response } com o erro pronto
// pra devolver (404 em vez de 403 pra não denunciar que a rota existe).
export async function requireGhost(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (!(await isGhostUser(userId))) {
    return { response: NextResponse.json({ error: "Não encontrado." }, { status: 404 }) };
  }
  return { userId };
}
