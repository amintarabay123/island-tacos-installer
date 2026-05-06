import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, asc } from "drizzle-orm";
import { db, employeesTable } from "@workspace/db";
import { requireAdminAuth } from "./auth";

const router: IRouter = Router();

async function seedFromEnvIfEmpty() {
  const count = await db.select().from(employeesTable).limit(1);
  if (count.length > 0) return;
  const adminPin = process.env["ADMIN_PIN"];
  const staffPin = process.env["STAFF_PIN"];
  if (adminPin) {
    await db.insert(employeesTable).values({
      name: "Owner",
      role: "owner",
      pinHash: await bcrypt.hash(adminPin, 10),
      active: true,
    });
  }
  if (staffPin) {
    await db.insert(employeesTable).values({
      name: "Staff",
      role: "staff",
      pinHash: await bcrypt.hash(staffPin, 10),
      active: true,
    });
  }
}

// Seed on module load
seedFromEnvIfEmpty().catch(console.error);

// GET /api/employees — list all (admin only)
router.get("/employees", requireAdminAuth, async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: employeesTable.id,
    name: employeesTable.name,
    role: employeesTable.role,
    active: employeesTable.active,
    createdAt: employeesTable.createdAt,
  }).from(employeesTable).orderBy(asc(employeesTable.createdAt));
  res.json(rows);
});

// POST /api/employees — create (admin only)
router.post("/employees", requireAdminAuth, async (req, res): Promise<void> => {
  const { name, role, pin } = req.body as { name?: string; role?: string; pin?: string };
  if (!name || !role || !pin) { res.status(400).json({ error: "name, role, and pin required" }); return; }
  if (!["owner", "staff"].includes(role)) { res.status(400).json({ error: "role must be owner or staff" }); return; }
  if (!/^\d{4,8}$/.test(pin)) { res.status(400).json({ error: "PIN must be 4–8 digits" }); return; }
  const pinHash = await bcrypt.hash(pin, 10);
  const [emp] = await db.insert(employeesTable).values({ name, role, pinHash, active: true }).returning({
    id: employeesTable.id, name: employeesTable.name, role: employeesTable.role, active: employeesTable.active,
  });
  res.status(201).json(emp);
});

// PATCH /api/employees/:id — update name, role, pin, active (admin only)
router.patch("/employees/:id", requireAdminAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  const { name, role, pin, active } = req.body as { name?: string; role?: string; pin?: string; active?: boolean };
  if (role && !["owner", "staff"].includes(role)) { res.status(400).json({ error: "role must be owner or staff" }); return; }
  if (pin && !/^\d{4,8}$/.test(pin)) { res.status(400).json({ error: "PIN must be 4–8 digits" }); return; }
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (pin !== undefined) updates.pinHash = await bcrypt.hash(pin, 10);
  if (active !== undefined) updates.active = active;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const [updated] = await db.update(employeesTable).set(updates).where(eq(employeesTable.id, id)).returning({
    id: employeesTable.id, name: employeesTable.name, role: employeesTable.role, active: employeesTable.active,
  });
  if (!updated) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(updated);
});

// DELETE /api/employees/:id (admin only)
router.delete("/employees/:id", requireAdminAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.json({ ok: true });
});

// POST /api/employees/verify-pin — used by auth (internal, no auth required)
export async function verifyPin(pin: string): Promise<{ valid: boolean; role: string; name: string } | null> {
  try {
    await seedFromEnvIfEmpty();
    const employees = await db.select().from(employeesTable).where(eq(employeesTable.active, true));
    for (const emp of employees) {
      const match = await bcrypt.compare(pin, emp.pinHash);
      if (match) return { valid: true, role: emp.role, name: emp.name };
    }
    // DB worked fine — PIN simply didn't match any employee
    return null;
  } catch {
    // DB unavailable (employees table missing, connection error, etc.)
    // Fall back to direct env var comparison so the system stays operational
    const adminPin = process.env["ADMIN_PIN"];
    const staffPin = process.env["STAFF_PIN"];
    if (adminPin && pin === adminPin) return { valid: true, role: "owner", name: "Owner" };
    if (staffPin && pin === staffPin) return { valid: true, role: "staff", name: "Staff" };
    return null;
  }
}

export default router;
