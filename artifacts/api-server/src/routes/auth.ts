import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router = Router();

const AVATAR_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#DC2626", "#D97706",
  "#7C2D12", "#1D4ED8", "#065F46", "#991B1B", "#92400E",
];

function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { username, password, displayName } = parsed.data;

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.username, username),
  });

  if (existing) {
    res.status(409).json({ message: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const avatarColor = randomAvatarColor();

  const [user] = await db
    .insert(usersTable)
    .values({ username, passwordHash, displayName, avatarColor })
    .returning();

  req.session.userId = user.id;

  res.status(201).json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    quizCount: user.quizCount,
    gameCount: user.gameCount,
  });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const { username, password } = parsed.data;

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.username, username),
  });

  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    quizCount: user.quizCount,
    gameCount: user.gameCount,
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.session.userId),
  });

  if (!user) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    quizCount: user.quizCount,
    gameCount: user.gameCount,
  });
});

export default router;
