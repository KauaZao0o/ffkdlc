import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Retorna o histórico de mensagens da conversa.
export async function GET(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const messages = await prisma.message.findMany({
    where: { conversationId: params.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, username: true, avatarColor: true } } },
  });

  return NextResponse.json(messages);
}

// Envia uma nova mensagem. O Supabase Realtime é quem avisa os outros
// clientes conectados assim que essa linha é inserida no banco - não
// precisamos emitir nada manualmente aqui.
export async function POST(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { content, type = "text", fileUrl } = await request.json();

  if (type === "image") {
    if (!fileUrl) {
      return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
    }
  } else if (!content || !content.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: { content: content || "", conversationId: params.id, senderId: userId, type, fileUrl },
    include: { sender: { select: { id: true, username: true, avatarColor: true } } },
  });

  return NextResponse.json(message, { status: 201 });
}
