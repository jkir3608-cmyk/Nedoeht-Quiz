import { Router } from "express";
import { db } from "@workspace/db";
import { adminMediaTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();
const ADMIN_PASSWORD = "2026BIOlogy!";

function checkPassword(pw: unknown): boolean {
  return pw === ADMIN_PASSWORD;
}

router.get("/admin/media", async (req, res) => {
  if (!checkPassword(req.query.password)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const items = await db
    .select()
    .from(adminMediaTable)
    .orderBy(desc(adminMediaTable.createdAt));
  res.json(items.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/admin/media", async (req, res) => {
  const { password, name, mediaType, dataSrc } = req.body ?? {};
  if (!checkPassword(password)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  if (!name || !mediaType || !dataSrc) {
    res.status(400).json({ message: "name, mediaType and dataSrc are required" });
    return;
  }
  if (mediaType !== "image" && mediaType !== "video") {
    res.status(400).json({ message: "mediaType must be image or video" });
    return;
  }
  const [item] = await db
    .insert(adminMediaTable)
    .values({ name: String(name).trim(), mediaType, dataSrc: String(dataSrc) })
    .returning();
  res.status(201).json({ ...item, createdAt: item.createdAt.toISOString() });
});

router.patch("/admin/media/:id", async (req, res) => {
  const { password, name } = req.body ?? {};
  if (!checkPassword(password)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const [item] = await db
    .update(adminMediaTable)
    .set({ name: String(name).trim() })
    .where(eq(adminMediaTable.id, id))
    .returning();
  if (!item) { res.status(404).json({ message: "Not found" }); return; }
  res.json({ ...item, createdAt: item.createdAt.toISOString() });
});

router.delete("/admin/media/:id", async (req, res) => {
  if (!checkPassword(req.query.password)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  await db.delete(adminMediaTable).where(eq(adminMediaTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
