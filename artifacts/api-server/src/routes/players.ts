import { Router } from "express";
import { db } from "@workspace/db";
import { gamesTable, playersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { UpdatePlayerBody } from "@workspace/api-zod";

const router = Router();

const ADMIN_PASSWORD = "2026BIOlogy!";

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  next();
}

router.get("/games/:gameId/players", async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  if (isNaN(gameId)) {
    res.status(400).json({ message: "Invalid game ID" });
    return;
  }

  const players = await db.query.playersTable.findMany({
    where: eq(playersTable.gameId, gameId),
    orderBy: (p) => [p.coins],
  });

  res.json(
    players.map((p) => ({
      ...p,
      joinedAt: p.joinedAt.toISOString(),
    })),
  );
});

router.patch("/games/:gameId/players/:playerId", async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const playerId = parseInt(req.params.playerId);

  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { coins, adminPassword } = parsed.data;

  const isAdmin = adminPassword === ADMIN_PASSWORD;
  const isHost = req.session.userId
    ? (await db.query.gamesTable.findFirst({
        where: and(
          eq(gamesTable.id, gameId),
          eq(gamesTable.hostId, req.session.userId),
        ),
      })) !== undefined
    : false;

  if (!isAdmin && !isHost) {
    res.status(403).json({ message: "Not authorized" });
    return;
  }

  const player = await db.query.playersTable.findFirst({
    where: and(eq(playersTable.id, playerId), eq(playersTable.gameId, gameId)),
  });

  if (!player) {
    res.status(404).json({ message: "Player not found" });
    return;
  }

  const updateData: Partial<typeof player> = {};
  if (coins !== undefined) updateData.coins = coins;

  const [updated] = await db
    .update(playersTable)
    .set(updateData)
    .where(eq(playersTable.id, playerId))
    .returning();

  res.json({
    ...updated,
    joinedAt: updated.joinedAt.toISOString(),
  });
});

router.delete("/games/:gameId/players/:playerId", async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const playerId = parseInt(req.params.playerId);

  const isHost = req.session.userId
    ? (await db.query.gamesTable.findFirst({
        where: and(
          eq(gamesTable.id, gameId),
          eq(gamesTable.hostId, req.session.userId),
        ),
      })) !== undefined
    : false;

  if (!isHost) {
    const adminPassword = req.headers["x-admin-password"];
    if (adminPassword !== ADMIN_PASSWORD) {
      res.status(403).json({ message: "Not authorized" });
      return;
    }
  }

  await db
    .update(playersTable)
    .set({ isKicked: true })
    .where(and(eq(playersTable.id, playerId), eq(playersTable.gameId, gameId)));

  res.json({ message: "Player kicked" });
});

export default router;
