import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

export async function POST(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { name, memberIds } = await request.json();
  if (!name || !Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: "Informe um nome e ao menos um participante." }, { status: 400 });
  }

  const uniqueMemberIds = Array.from(new Set([...memberIds, userId]));

  try {
    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        name,
        members: {
          create: uniqueMemberIds.map((id) => ({ userId: id, isAdmin: id === userId })),
        },
      },
    });

    return NextResponse.json({ id: group.id, name: group.name }, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar grupo:", err);
    return NextResponse.json(
      { error: "Não foi possível criar o grupo. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
