-- CreateTable
CREATE TABLE "HiddenPeer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hiddenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenPeer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiddenPeer_userId_idx" ON "HiddenPeer"("userId");

-- CreateIndex
CREATE INDEX "HiddenPeer_hiddenId_idx" ON "HiddenPeer"("hiddenId");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenPeer_userId_hiddenId_key" ON "HiddenPeer"("userId", "hiddenId");

-- AddForeignKey
ALTER TABLE "HiddenPeer" ADD CONSTRAINT "HiddenPeer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenPeer" ADD CONSTRAINT "HiddenPeer_hiddenId_fkey" FOREIGN KEY ("hiddenId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
