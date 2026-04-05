import { db } from "@atlas/db";
async function check() {
  const items = await db.contentItem.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  const count = items.filter(i => i.imageUrl).length;
  console.log(`Recent 20 items with imageUrl: ${count}`);
}
check();
