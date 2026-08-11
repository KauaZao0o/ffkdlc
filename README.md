# Chat App (Next.js + Supabase)

Chat em tempo real com cadastro/login, conversas privadas, grupos e
mensagens instantâneas. Roda inteiramente em **um único projeto Next.js**
(front-end + API), hospedado de graça na Vercel, com banco Postgres
gratuito no Supabase.

## Por que essa arquitetura

- **Um projeto só**: as páginas React e as rotas de API vivem juntas no
  Next.js (App Router), então não existe "back-end separado" para
  hospedar - é tudo a mesma Vercel.
- **Sem Socket.IO**: a Vercel roda funções serverless (elas não mantêm
  conexão aberta o tempo todo), então um servidor de WebSocket tradicional
  não funciona lá. Em vez disso, usamos o **Supabase Realtime**: quando
  uma mensagem é salva no banco, o Supabase já avisa os clientes
  conectados automaticamente, sem precisar de servidor nenhum.
- **Indicador de "digitando..."** também usa o Supabase (canal de
  broadcast), pelo mesmo motivo.

## Stack

- **Front-end + API**: Next.js (App Router) + React
- **Banco de dados**: Postgres gratuito do Supabase, acessado via Prisma
- **Tempo real**: Supabase Realtime (Postgres Changes + Broadcast)
- **Autenticação**: JWT em cookie httpOnly + bcrypt (usuário/senha, sem e-mail)
- **Hospedagem**: Vercel (plano gratuito)

## Passo 1 — Criar o projeto no Supabase

1. Crie uma conta em https://supabase.com e um novo projeto (escolha uma
   senha forte para o banco, você vai precisar dela).
2. Em **Settings → Database**, copie duas connection strings:
   - **Connection pooling** (porta 6543) → vai virar `DATABASE_URL`
   - **Direct connection** (porta 5432) → vai virar `DIRECT_URL`
3. Em **Settings → API**, copie:
   - **Project URL** → vai virar `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → vai virar `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Passo 2 — Configurar o projeto localmente

```bash
npm install
cp .env.example .env.local
```

Preencha o `.env.local` com os valores copiados no Passo 1, mais um
`JWT_SECRET` qualquer (uma frase aleatória serve).

Depois crie as tabelas no Supabase a partir do schema do Prisma:

```bash
npx prisma migrate dev --name init
```

## Passo 3 — Ativar o Realtime na tabela de mensagens

Isso é essencial, sem isso as mensagens não chegam em tempo real. No
painel do Supabase, vá em **Database → Replication**, encontre a tabela
`messages` e ative o toggle. Ou rode este SQL no **SQL Editor**:

```sql
alter publication supabase_realtime add table messages;
```

## Passo 4 — Rodar localmente

```bash
npm run dev
```

Abra `http://localhost:3000`, crie duas contas (usuário + senha, sem
e-mail) em abas diferentes e teste o chat em tempo real.

## Passo 5 — Publicar de graça na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Crie uma conta em https://vercel.com e importe esse repositório
   (a Vercel detecta que é Next.js automaticamente).
3. Em **Environment Variables**, adicione as mesmas variáveis do seu
   `.env.local`: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Pronto — front-end, API e tempo real funcionando num único
   domínio gratuito (`seu-chat.vercel.app`).

Como front-end e API ficam no mesmo domínio, não existe configuração de
CORS para se preocupar.

## Estrutura do projeto

```
chat-next/
├── prisma/schema.prisma        # modelos do banco (Postgres/Supabase)
├── src/
│   ├── app/
│   │   ├── login/, register/, chat/   # páginas
│   │   └── api/                       # rotas de API (auth, conversas, grupos...)
│   ├── components/
│   │   ├── sidebar/    (ConversationList, ConversationItem)
│   │   ├── chat/        (ChatWindow, MessageBubble, MessageInput)
│   │   └── group/       (ParticipantsList, CreateGroupModal)
│   ├── context/AuthContext.jsx
│   └── lib/
│       ├── prisma.js           # cliente Prisma
│       ├── auth.js             # JWT + cookies
│       └── supabaseClient.js   # cliente Supabase (só Realtime, no navegador)
```

## Novidades desta versão

- **Rede de segurança para o tempo real**: além do Supabase Realtime (que
  entrega mensagens instantaneamente), o `ChatWindow` agora também busca o
  histórico atualizado a cada 4 segundos em segundo plano. Isso garante
  que, mesmo se o Realtime falhar por algum motivo (RLS mal configurado,
  rede, etc), as mensagens continuam chegando sem precisar dar refresh.
- **Apagar mensagem**: passe o mouse sobre uma mensagem sua para ver o
  ícone de lixeira. Só quem escreveu a mensagem pode apagá-la.
- **Três ações de grupo, como no WhatsApp**:
  - **Apagar para mim** (botão no topo da conversa, funciona em qualquer
    conversa): some da sua lista, mas continua existindo para os outros.
    Se chegar mensagem nova depois, ela reaparece sozinha.
  - **Sair do grupo** (painel de participantes, qualquer membro): você
    deixa de participar de verdade. Se você era o único admin, o
    participante mais antigo vira admin automaticamente.
  - **Excluir grupo para todos** (painel de participantes, só admin):
    apaga o grupo e todas as mensagens em cascata.

> **Importante**: essas funcionalidades dependem da migration que
> adiciona `onDelete: Cascade` e o campo `hiddenAt`. Depois de atualizar
> o projeto, rode `npx prisma migrate dev` de novo antes de testar -
> veja o Passo 2 mais abaixo.

## Onde adicionar as funcionalidades futuras

| Funcionalidade | Onde mexer |
|---|---|
| Imagens/vídeos/arquivos | `Message.type` e `Message.fileUrl` já existem no schema; para upload gratuito, dá para usar o **Supabase Storage** (tem plano free) |
| Áudio | Mesmo caminho dos arquivos, `type: "audio"` |
| Reações com emoji | Nova tabela `Reaction` (messageId, userId, emoji) |
| Tema claro/escuro | `src/app/globals.css` + um contexto de tema |
| Pesquisa de mensagens | Nova rota de API com `WHERE content ILIKE` |
| Notificações | Web Notifications API no front, disparada pelo mesmo canal Realtime |
| Status online/offline | `User.isOnline` já existe; dá para atualizar usando o **Presence** do Supabase Realtime (também gratuito, sem servidor) |
| Chamadas de voz/vídeo | WebRTC, usando o canal do Supabase Realtime como sinalização |
| App mobile | React Native reaproveitando as mesmas rotas de API |
| Criptografia | Criptografar `Message.content` antes de salvar, ou E2E com libsodium no cliente |
| Painel de administração | Nova área em `src/app/admin` + rotas `/api/admin` protegidas |

## Solução de problemas comuns

**Mensagens não chegam em tempo real, só depois de recarregar a página**
Você provavelmente esqueceu o Passo 3 (ativar Realtime na tabela `messages`).

**`Environment variable not found: DATABASE_URL`**
Confirme que o arquivo se chama exatamente `.env.local` (não `.env` nem
`.env.example`) e está na raiz do projeto.

**Erro de conexão com o banco em produção**
Confirme que `DATABASE_URL` na Vercel é a **connection pooling** (porta
6543) do Supabase, não a direta — funções serverless não seguram conexões
abertas como um servidor tradicional.
