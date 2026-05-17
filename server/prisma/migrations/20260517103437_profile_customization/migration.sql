-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarColor" TEXT NOT NULL DEFAULT '#10b981',
ADD COLUMN     "bannerPath" TEXT,
ADD COLUMN     "fontPref" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'light';
