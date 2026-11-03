import bcrypt from 'bcrypt';
import { db } from './services/db.js';
import { UserRole } from '@gatigo/shared';
import { logger } from './common/logger.js';

export async function runSeed() {
  logger.info('Running database seed initialization...');

  // 1. Primary Justcomes Super Admin
  const primaryAdminEmail = 'admin@justcomes.in';
  let primaryAdmin = await db.users.findByEmail(primaryAdminEmail);
  if (!primaryAdmin) {
    primaryAdmin = await db.users.create({
      phone: '+919504329735',
      email: primaryAdminEmail,
      name: 'Justcomes Chief Admin',
      preferredLanguage: 'hi',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isVerified: true
    });

    const passwordHash = await bcrypt.hash('Priyansh@9504', 10);
    await db.adminUsers.create({
      userId: primaryAdmin.id,
      department: 'CENTRAL_OPERATIONS',
      passwordHash
    });
    logger.info(`Super Admin seeded: ${primaryAdminEmail} (Password: Priyansh@9504)`);
  }

  // 2. Secondary GatiGo Admin for legacy / compatibility
  const secondaryAdminEmail = 'admin@gatigo.in';
  let secondaryAdmin = await db.users.findByEmail(secondaryAdminEmail);
  if (!secondaryAdmin) {
    secondaryAdmin = await db.users.create({
      phone: '+919876599999',
      email: secondaryAdminEmail,
      name: 'GatiGo Chief Admin',
      preferredLanguage: 'en',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isVerified: true
    });

    const passwordHash = await bcrypt.hash('AdminPassword@2026', 10);
    await db.adminUsers.create({
      userId: secondaryAdmin.id,
      department: 'CENTRAL_OPERATIONS',
      passwordHash
    });
    logger.info(`Super Admin seeded: ${secondaryAdminEmail} (Password: AdminPassword@2026)`);
  }

  // NOTE: All dummy drivers (Suresh Mahto, Ramesh Kumar, Vikram Singh) and dummy customers
  // have been completely removed as requested. Real drivers registering from the mobile
  // app will be stored dynamically in the database.
  logger.info('Database seed completed successfully with zero dummy driver data.');
}
