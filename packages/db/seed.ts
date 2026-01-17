import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await hash('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@legacyvideo.com' },
    update: {},
    create: {
      email: 'admin@legacyvideo.com',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      emailVerified: true,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create test user
  const testPassword = await hash('test123!', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      passwordHash: testPassword,
      role: UserRole.USER,
      emailVerified: true,
    },
  });
  console.log('✅ Created test user:', testUser.email);

  // Create a sample legacy plan
  const plan = await prisma.legacyPlan.create({
    data: {
      userId: testUser.id,
      title: 'My Legacy Messages',
      description: 'Important messages for my family',
      approvalThreshold: 2,
      totalVerifiers: 3,
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created legacy plan:', plan.title);

  // Create sample verifiers
  const verifiers = await Promise.all([
    prisma.verifier.create({
      data: {
        planId: plan.id,
        email: 'verifier1@example.com',
        name: 'Alice Verifier',
        token: 'sample-token-1',
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    }),
    prisma.verifier.create({
      data: {
        planId: plan.id,
        email: 'verifier2@example.com',
        name: 'Bob Verifier',
        token: 'sample-token-2',
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    }),
    prisma.verifier.create({
      data: {
        planId: plan.id,
        email: 'verifier3@example.com',
        name: 'Carol Verifier',
        token: 'sample-token-3',
        status: 'INVITED',
      },
    }),
  ]);
  console.log('✅ Created', verifiers.length, 'verifiers');

  // Create audit event
  await prisma.auditEvent.create({
    data: {
      userId: testUser.id,
      action: 'PLAN_CREATED',
      entityType: 'LegacyPlan',
      entityId: plan.id,
      metadata: { title: plan.title },
    },
  });
  console.log('✅ Created audit event');

  console.log('🎉 Seeding completed!');
  console.log('\n📋 Test credentials:');
  console.log('  Admin: admin@legacyvideo.com / admin123!');
  console.log('  User:  test@example.com / test123!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
