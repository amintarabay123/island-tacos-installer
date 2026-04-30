import { db, menuItemsTable, menuCategoriesTable } from "@workspace/db";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { logger } from "./logger";

const BVI_TZ = "America/Puerto_Rico";

async function runMidnightReset(): Promise<void> {
  const miscCategories = await db
    .select({ id: menuCategoriesTable.id })
    .from(menuCategoriesTable)
    .where(sql`lower(${menuCategoriesTable.name}) = 'misc'`);

  const miscIds = miscCategories.map(c => c.id);

  const updated = await (miscIds.length > 0
    ? db.update(menuItemsTable)
        .set({ available: true })
        .where(and(
          eq(menuItemsTable.available, false),
          notInArray(menuItemsTable.categoryId, miscIds),
        ))
        .returning({ id: menuItemsTable.id, name: menuItemsTable.name })
    : db.update(menuItemsTable)
        .set({ available: true })
        .where(eq(menuItemsTable.available, false))
        .returning({ id: menuItemsTable.id, name: menuItemsTable.name })
  );

  if (updated.length > 0) {
    logger.info(
      { items: updated.map(i => i.name) },
      `Midnight reset: ${updated.length} item(s) restored to available`,
    );
  } else {
    logger.info("Midnight reset: no sold-out items to restore");
  }
}

let lastResetDate: string | null = null;

export function startMidnightResetScheduler(): void {
  setInterval(() => {
    const bviTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: BVI_TZ }),
    );
    const h = bviTime.getHours();
    const m = bviTime.getMinutes();
    const dateStr = bviTime.toDateString();

    if (h === 0 && m === 0 && dateStr !== lastResetDate) {
      lastResetDate = dateStr;
      runMidnightReset().catch(e =>
        logger.error({ err: e }, "Midnight reset error"),
      );
    }
  }, 60_000);
}
