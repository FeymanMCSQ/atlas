import { db } from "@atlas/db";
async function check() {
  const ctoSource = await db.feedSource.findFirst({ where: { name: 'CTO Craft' } });
  if (ctoSource) {
    const items = await db.contentItem.findMany({ where: { source: ctoSource.id }, orderBy: { createdAt: 'desc' }, take: 5 });
    for (const item of items) { console.log(item.title, "Has Image?", !!item.imageUrl); }
  }
}
check();
