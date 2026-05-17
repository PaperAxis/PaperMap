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
