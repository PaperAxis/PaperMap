import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { peersWhoHidFrom, relatedUserIds } from '../visibility.js';
import { createNotification } from '../notify.js';
import { distanceMeters } from '../geofence.js';

const router = Router();

// Buluşma ETA'si icin varsayilan hiz (m/s) — socket.js ile ayni
const DEFAULT_SPEED = 8.3;
const ARRIVED_METERS = 150;

function sharingActive(u) {
  if (!u.sharingEnabled) return false;
  if (u.sharingUntil && new Date(u.sharingUntil).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

function meetingView(m, myId) {
  return {
    id: m.id,
    label: m.label,
    lat: m.lat,
    lng: m.lng,
    isOwner: m.ownerId === myId,
    memberCount: m._count?.members,
    createdAt: m.createdAt,
  };
}

// Üyesi oldugum bulusmalar
router.get('/', requireAuth, async (req, res) => {
  const memberships = await prisma.meetingMember.findMany({
    where: { userId: req.userId },
    include: { meeting: { include: { _count: { select: { members: true } } } } },
    orderBy: { meeting: { createdAt: 'desc' } },
  });
  res.json({
    meetings: memberships.map((m) => meetingView(m.meeting, req.userId)),
  });
});

// Buluşma olustur
router.post('/', requireAuth, async (req, res) => {
  const { label, lat, lng, memberIds } = req.body || {};
  if (!label || !String(label).trim()) {
    return res.status(400).json({ error: 'Buluşma adı zorunlu' });
  }
  const la = Number(lat);
  const ln = Number(lng);
  if (
    !Number.isFinite(la) || !Number.isFinite(ln) ||
    la < -90 || la > 90 || ln < -180 || ln > 180
  ) {
    return res.status(400).json({ error: 'Geçersiz konum' });
  }
  const related = await relatedUserIds(req.userId);
  const ids = Array.isArray(memberIds) ? memberIds : [];
  const valid = [
    ...new Set(ids.filter((id) => related.has(id) && id !== req.userId)),
  ];

  const meeting = await prisma.meeting.create({
    data: {
      ownerId: req.userId,
      label: String(label).trim().slice(0, 80),
      lat: la,
      lng: ln,
      members: { create: [req.userId, ...valid].map((userId) => ({ userId })) },
    },
    include: { _count: { select: { members: true } } },
  });

  const me = await prisma.user.findUnique({ where: { id: req.userId } });
  for (const uid of valid) {
    createNotification(
      uid,
      'Buluşma daveti',
      `${me.displayName} seni "${meeting.label}" buluşmasına ekledi.`,
    ).catch(() => {});
  }
  res.status(201).json({ meeting: meetingView(meeting, req.userId) });
});

// Buluşma detayi — her uyenin nokta'ya ETA'si
router.get('/:id', requireAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: { include: { location: true } } } },
    },
  });
  if (!meeting || !meeting.members.some((m) => m.userId === req.userId)) {
    return res.status(404).json({ error: 'Buluşma bulunamadı' });
  }
  // Konumunu izleyenden gizleyen uyelerin mesafe/ETA'si hesaplanmaz.
  const hidFromMe = await peersWhoHidFrom(req.userId);
  const members = meeting.members.map((m) => {
    const u = m.user;
    const visible = u.id === req.userId || !hidFromMe.has(u.id);
    let distance = null;
    let etaMinutes = null;
    let arrived = false;
    let locationOff = true;
    if (visible && u.location && sharingActive(u)) {
      locationOff = false;
      distance = Math.round(
        distanceMeters(u.location.lat, u.location.lng, meeting.lat, meeting.lng),
      );
      arrived = distance <= ARRIVED_METERS;
      etaMinutes = arrived
        ? 0
        : Math.max(1, Math.round(distance / DEFAULT_SPEED / 60));
    }
    return {
      userId: u.id,
      displayName: u.displayName,
      avatarColor: u.avatarColor,
      avatarPath: u.avatarPath,
      isOwner: u.id === meeting.ownerId,
      distanceMeters: distance,
      etaMinutes,
      arrived,
      locationOff,
      updatedAt: u.location?.updatedAt ?? null,
    };
  });
  members.sort((a, b) => {
    if (a.etaMinutes == null) return 1;
    if (b.etaMinutes == null) return -1;
    return a.etaMinutes - b.etaMinutes;
  });
  res.json({ meeting: meetingView(meeting, req.userId), members });
});

// Buluşmayi sil (yalnizca sahip)
router.delete('/:id', requireAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!meeting || meeting.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Buluşma bulunamadı' });
  }
  await prisma.meeting.delete({ where: { id: meeting.id } });
  res.json({ ok: true });
});

// Buluşmadan ayril (sahip ayrilamaz — silmeli)
router.post('/:id/leave', requireAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!meeting) {
    return res.status(404).json({ error: 'Buluşma bulunamadı' });
  }
  if (meeting.ownerId === req.userId) {
    return res
      .status(400)
      .json({ error: 'Buluşmanın sahibi ayrılamaz; buluşmayı silebilirsiniz.' });
  }
  await prisma.meetingMember.deleteMany({
    where: { meetingId: meeting.id, userId: req.userId },
  });
  res.json({ ok: true });
});

export default router;
