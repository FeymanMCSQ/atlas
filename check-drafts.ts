import { db } from './packages/db/src/index.js';

async function run() {
  const drafts = await db.draft.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2,
  });
  console.log(JSON.stringify(drafts, null, 2));
  process.exit(0);
}
run();
