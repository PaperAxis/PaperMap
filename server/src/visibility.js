import { prisma } from './prisma.js';

// Bir kullaniciyla iliskili (kabul edilmis arkadas VEYA ayni ailede) tum
// kullanici id'lerini dondurur. Iliski simetriktir.
export async function relatedUserIds(userId) {
  const ids = new Set();

  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
  for (const f of friendships) {
    ids.add(f.requesterId === userId ? f.addresseeId : f.requesterId);
  }

  const myFamilies = await prisma.familyMember.findMany({
    where: { userId },
    select: { familyId: true },
  });
  if (myFamilies.length > 0) {
    const coMembers = await prisma.familyMember.findMany({
      where: {
        familyId: { in: myFamilies.map((m) => m.familyId) },
        userId: { not: userId },
      },
      select: { userId: true },
    });
    for (const m of coMembers) ids.add(m.userId);
  }

  ids.delete(userId);
  return ids;
}

// userId'nin konumunu gizledigi kisilerin id'leri
export async function hiddenByUser(userId) {
  const rows = await prisma.hiddenPeer.findMany({
    where: { userId },
    select: { hiddenId: true },
  });
  return new Set(rows.map((r) => r.hiddenId));
}

// viewerId'den konumunu gizleyen kisilerin id'leri
export async function peersWhoHidFrom(viewerId) {
  const rows = await prisma.hiddenPeer.findMany({
    where: { hiddenId: viewerId },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}
