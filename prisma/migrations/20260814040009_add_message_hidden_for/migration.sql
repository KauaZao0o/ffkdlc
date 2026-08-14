-- CreateTable
CREATE TABLE "message_hidden_for" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hidden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_hidden_for_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_hidden_for_message_id_user_id_key" ON "message_hidden_for"("message_id", "user_id");

-- AddForeignKey
ALTER TABLE "message_hidden_for" ADD CONSTRAINT "message_hidden_for_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_hidden_for" ADD CONSTRAINT "message_hidden_for_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
