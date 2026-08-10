import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: params.id },
    include: { user: { select: { id: true, username: true, avatarColor: true, isOnline: true } } },
  });

  return NextResponse.json(members.map((m) => ({ ...m.user, isAdmin: m.isAdmin })));
}
