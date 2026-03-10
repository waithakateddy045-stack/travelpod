const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const SALT_ROUNDS = 12;
const SHARED_PASSWORD = 'Admin1234';

async function setup() {
    try {
        const hashed = await bcrypt.hash(SHARED_PASSWORD, SALT_ROUNDS);

        const accounts = [
            { email: 'admin@travelpod.com', username: 'admin', accountType: 'ADMIN' },
            { email: 'official@travelpod.com', username: 'official_travelpod', accountType: 'ADMIN' },
            { email: 'waithakateddy045@gmail.com', username: 'waithaka_admin', accountType: 'ADMIN' }
        ];

        for (const acc of accounts) {
            console.log(`Setting up ${acc.email}...`);
            await prisma.user.upsert({
                where: { email: acc.email },
                update: {
                    password: hashed,
                    accountType: acc.accountType,
                    isAdmin: true,
                    isVerified: true
                },
                create: {
                    email: acc.email,
                    username: acc.username,
                    password: hashed,
                    accountType: acc.accountType,
                    isAdmin: true,
                    isVerified: true,
                    displayName: acc.username === 'official_travelpod' ? 'Official Travelpod' : acc.username
                }
            });
        }
        console.log('Admin accounts synchronized.');
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

setup();
