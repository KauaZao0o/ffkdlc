import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

const REPLY_PREVIEW_SELECT = {
  id: true,
  content: true,
  type: true,
  fileUrl: true,
  sender: { select: { username: true } },
};

// Retorna o histórico de mensagens da conversa.
export async function GET(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const messages = await prisma.message.findMany({
    where: {
      conversationId: params.id,
      hiddenFor: { none: { userId } },
    },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, username: true, avatarColor: true, avatarUrl: true } },
      replyTo: { select: REPLY_PREVIEW_SELECT },
    },
  });

  return NextResponse.json(messages);
}

// Envia uma nova mensagem. O Supabase Realtime é quem avisa os outros
// clientes conectados assim que essa linha é inserida no banco - não
// precisamos emitir nada manualmente aqui.
export async function POST(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { content, type = "text", fileUrl, replyToId } = await request.json();

  if (type === "image" || type === "audio" || type === "file") {
    if (!fileUrl) {
      return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
    }
  } else if (!content || !content.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  // Confere se a mensagem citada é de fato dessa conversa, pra ninguém
  // conseguir "responder" citando uma mensagem de outro chat.
  let validReplyToId = null;
  if (replyToId) {
    const target = await prisma.message.findFirst({
      where: { id: replyToId, conversationId: params.id },
      select: { id: true },
    });
    if (target) validReplyToId = target.id;
  }

  const message = await prisma.message.create({
    data: {
      content: content || "",
      conversationId: params.id,
      senderId: userId,
      type,
      fileUrl,
      replyToId: validReplyToId,
    },
    include: {
      sender: { select: { id: true, username: true, avatarColor: true, avatarUrl: true } },
      replyTo: { select: REPLY_PREVIEW_SELECT },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
