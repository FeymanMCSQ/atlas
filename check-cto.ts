import { db } from "@atlas/db";
async function check() {
  const ctoSource = await db.feedSource.findFirst({ where: { name: 'CTO Craft' } });
  if (ctoSource) {
    const items = await db.contentItem.findMany({ where: { source: ctoSource.id } });
    const withImages = items.filter(i => i.imageUrl).length;
    console.log(`CTO Craft Total: ${items.length}, With Images: ${withImages}`);
  }
}
check();
