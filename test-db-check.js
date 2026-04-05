const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
prisma.contentItem.findFirst({ where: { imageUrl: { not: null } } })
  .then(item => console.log(item ? `✅ Found image: ${item.imageUrl}` : "❌ No images found."))
  .finally(() => prisma.$disconnect());
