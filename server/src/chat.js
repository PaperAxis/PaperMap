import { prisma } from './prisma.js';

// Aile sohbetini olusturur (yoksa) ve uyelerini aile uyeleriyle esitler.
// Aile olusturulunca / katilinca / ayrilinca cagrilir.
export async function syncFamilyConversation(familyId) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { members: true, conversation: true },
  });
  if (!family) return null;

  let conv = family.conversation;
  if (!conv) {
    conv = await prisma.conversation.create({
      data: { type: 'family', familyId, name: family.name },
    });
  }

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId: conv.id },
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const familyMemberIds = new Set(family.members.map((m) => m.userId));

  for (const m of family.members) {
    if (!existingIds.has(m.userId)) {
      await prisma.conversationMember.create({
        data: { conversationId: conv.id, userId: m.userId },
      });
    }
  }
  for (const e of existing) {
    if (!familyMemberIds.has(e.userId)) {
      await prisma.conversationMember.delete({ where: { id: e.id } });
    }
  }
  return conv;
}

// Iki kullanici arasindaki birebir sohbeti bulur, yoksa olusturur.
export async function getOrCreateDirect(userId, otherId) {
  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'direct',
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: otherId } } },
      ],
    },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: {
      type: 'direct',
      members: { create: [{ userId }, { userId: otherId }] },
    },
  });
}
