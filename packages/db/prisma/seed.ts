import { db as prisma } from '../src/index.js';

const coreFeeds = [
  { name: 'Netflix TechBlog', url: 'https://netflixtechblog.com/feed' },
  { name: 'CNCF Blog', url: 'https://www.cncf.io/blog/feed/' },
  { name: 'Uber Engineering', url: 'https://www.uber.com/en-US/blog/engineering/rss/' },
  { name: 'Indie Hackers', url: 'https://www.indiehackers.com/feed.xml' },
];

async function main() {
  console.log('Seeding database with primary RSS feeds (Platform Eng + Indie SaaS)...');

  for (const feed of coreFeeds) {
    const upsertFeed = await prisma.feedSource.upsert({
      where: { url: feed.url },
      update: {},
      create: {
        name: feed.name,
        url: feed.url,
        isActive: true,
      },
    });
    console.log(`✅ Upserted FeedSource: ${upsertFeed.name} (${upsertFeed.id})`);
  }

  console.log('\nDatabase seeded successfully.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
