import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { id: { not: userId } },
    select: { id: true, username: true, avatarColor: true, isOnline: true },
  });

  return NextResponse.json(users);
}
