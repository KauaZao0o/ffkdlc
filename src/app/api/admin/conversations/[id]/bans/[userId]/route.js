import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireGhost } from "@/lib/auth";

// Remove o banimento (a pessoa volta a poder ser adicionada ao grupo). Só
// a conta Ghost tem acesso.
export async function DELETE(request, { params }) {
  const { response } = await requireGhost(request);
  if (response) return response;

  await prisma.groupBan
    .delete({ where: { conversationId_userId: { conversationId: params.id, userId: params.userId } } })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
