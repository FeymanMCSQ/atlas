import { db } from "@atlas/db";
async function check() {
  const items = await db.contentItem.findMany({ where: { title: { contains: 'Efficiency Gains' } } });
  console.log(items);
}
check();
