/**
 * Seed Gamification Badges
 * Run: node prisma/seed-badges.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BADGES = [
    { name: 'Explorer', description: 'Uploaded your first video', icon: '🌍', tier: 'BRONZE', criteria: { type: 'posts_count', threshold: 1 } },
    { name: 'Frequent Flyer', description: 'Uploaded 10 videos', icon: '✈️', tier: 'SILVER', criteria: { type: 'posts_count', threshold: 10 } },
    { name: 'Safari King', description: 'Posted Kenya/Africa content 5 times', icon: '🦁', tier: 'GOLD', criteria: { type: 'africa_posts', threshold: 5 } },
    { name: 'Beach Lover', description: 'Posted beach content 5 times', icon: '🏖️', tier: 'SILVER', criteria: { type: 'beach_posts', threshold: 5 } },
    { name: 'Rising Star', description: 'Received 100 likes total', icon: '💫', tier: 'BRONZE', criteria: { type: 'likes_total', threshold: 100 } },
    { name: 'Influencer', description: 'Received 1,000 likes total', icon: '⭐', tier: 'GOLD', criteria: { type: 'likes_total', threshold: 1000 } },
    { name: 'Social Butterfly', description: 'Followed 50 people', icon: '🤝', tier: 'BRONZE', criteria: { type: 'following_count', threshold: 50 } },
    { name: 'Content Creator', description: 'Uploaded 25 videos', icon: '📸', tier: 'SILVER', criteria: { type: 'posts_count', threshold: 25 } },
    { name: 'Verified Partner', description: 'Got business verification', icon: '🏆', tier: 'GOLD', criteria: { type: 'verified' } },
    { name: 'Travelpod Elite', description: 'Received 10,000 likes total', icon: '👑', tier: 'PLATINUM', criteria: { type: 'likes_total', threshold: 10000 } },
];

async function main() {
    console.log('🏅 Seeding gamification badges...');
    for (const badge of BADGES) {
        await prisma.gamificationBadge.upsert({
            where: { name: badge.name },
            update: { description: badge.description, icon: badge.icon, tier: badge.tier, criteria: badge.criteria },
            create: badge,
        });
        console.log(`  ${badge.icon} ${badge.name} (${badge.tier})`);
    }
    console.log('🏅 Done!');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
