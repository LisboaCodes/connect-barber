-- Imagens enviadas pelo painel (logo, capa, galeria, avatares)
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_files_tenantId_idx" ON "media_files"("tenantId");
CREATE INDEX "media_files_userId_idx" ON "media_files"("userId");
