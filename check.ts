import { db } from "@atlas/db";
async function check() {
  const items = await db.contentItem.findMany({ select: { title: true, imageUrl: true } });
  const withImages = items.filter(i => i.imageUrl);
  console.log(`Total: ${items.length}, With Images: ${withImages.length}`);
}
check();
