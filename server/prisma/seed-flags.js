/**
 * Seed Feature Flags
 * Run: node prisma/seed-flags.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FLAGS = [
    { name: 'sponsored_promotions', isEnabled: false, description: 'Enable boost/promote post feature for businesses and creators' },
    { name: 'gamification', isEnabled: false, description: 'Enable badge achievements and gamification system' },
    { name: 'collaborations', isEnabled: false, description: 'Enable collaboration request system between users' },
    { name: 'otp_system', isEnabled: false, description: 'Global Email OTP system for registrations and logins' },
];

async function main() {
    console.log('🚩 Seeding feature flags...');
    for (const flag of FLAGS) {
        await prisma.featureFlag.upsert({
            where: { name: flag.name },
            update: { description: flag.description },
            create: flag,
        });
        console.log(`  ✓ ${flag.name} (${flag.isEnabled ? 'ON' : 'OFF'})`);
    }
    console.log('🚩 Done!');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
