import { PrismaClient } from "./packages/db/node_modules/@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const item = await prisma.contentItem.findFirst({ where: { imageUrl: { not: null } } });
  console.log(item ? `✅ Found item with imageUrl: ${item.imageUrl}` : "❌ No images backfilled yet.");
}
run();
