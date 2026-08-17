-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "registration_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
