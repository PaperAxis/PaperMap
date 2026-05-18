-- AlterTable: kullanici adi alani (once nullable eklenir, doldurulur, sonra NOT NULL)
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Mevcut kullanicilara gecici benzersiz bir kullanici adi ata
UPDATE "User" SET "username" = 'user_' || substr("id", 1, 12) WHERE "username" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- NOT NULL kisitlamasi
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
