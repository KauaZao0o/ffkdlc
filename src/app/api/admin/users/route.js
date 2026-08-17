import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireGhost } from "@/lib/auth";

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
