import bcrypt from 'bcrypt';
import { db } from './services/db.js';
import { UserRole, KycStatus, VehicleCategory } from '@gatigo/shared';
import { logger } from './common/logger.js';

export async function runSeed() {
  logger.info('Running database seed initialization...');

  // 1. Super Admin
  const adminEmail = 'admin@gatigo.in';
  let adminUser = await db.users.findByEmail(adminEmail);
  if (!adminUser) {
    adminUser = await db.users.create({
      phone: '+919876599999',
      email: adminEmail,
      name: 'GatiGo Chief Admin',
      preferredLanguage: 'en',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isVerified: true
    });

    const passwordHash = await bcrypt.hash('AdminPassword@2026', 10);
    await db.adminUsers.create({
      userId: adminUser.id,
      department: 'CENTRAL_OPERATIONS',
      passwordHash
    });
    logger.info(`Super Admin seeded: ${adminEmail} (Password: AdminPassword@2026)`);
  }

  // 2. Test Customer (Aarav Sharma - Ranchi)
  const customerPhone = '+919876500001';
  let customerUser = await db.users.findByPhone(customerPhone);
  if (!customerUser) {
    customerUser = await db.users.create({
      phone: customerPhone,
      email: 'aarav.customer@gatigo.in',
      name: 'Aarav Sharma',
      preferredLanguage: 'hi',
      role: UserRole.CUSTOMER,
      isActive: true,
      isVerified: true
    });

    const custProfile = await db.customerProfiles.create({
      userId: customerUser.id,
      emergencyContactName: 'Sunita Sharma',
      emergencyContactPhone: '+919876500099',
      ratingAverage: 4.95,
      totalTrips: 14
    });

    // Saved Addresses
    await db.savedAddresses.create({
      customerId: custProfile.id,
      label: 'Home',
      address: 'Harmu Housing Colony, Ranchi, Jharkhand',
      latitude: 23.3524,
      longitude: 85.3112
    });

    await db.savedAddresses.create({
      customerId: custProfile.id,
      label: 'Office',
      address: 'Main Road, GEL Church Complex, Ranchi',
      latitude: 23.3619,
      longitude: 85.3255
    });

    logger.info(`Test Customer seeded: Aarav Sharma (${customerPhone})`);
  }

  // 3. Test Driver A (Suresh Mahto - Ranchi) - Verified
  const driverAPhone = '+919876500002';
  let driverAUser = await db.users.findByPhone(driverAPhone);
  if (!driverAUser) {
    driverAUser = await db.users.create({
      phone: driverAPhone,
      email: 'suresh.driver@gatigo.in',
      name: 'Suresh Mahto (Driver A)',
      preferredLanguage: 'hi',
      role: UserRole.DRIVER,
      isActive: true,
      isVerified: true
    });

    const driverAProfile = await db.driverProfiles.create({
      userId: driverAUser.id,
      licenseNumber: 'JH0120180045921',
      experienceYears: 7,
      kycStatus: KycStatus.VERIFIED,
      serviceCity: 'Ranchi',
      operatingState: 'Jharkhand',
      ratingAverage: 4.88,
      totalCompletedTrips: 210,
      totalSharedCreated: 15,
      totalSharedFulfilled: 0,
      bankAccountHolder: 'Suresh Mahto',
      bankAccountNumber: '918237461928',
      bankIfscCode: 'SBIN0001234',
      upiId: 'sureshmahto@oksbi'
    });

    await db.vehicles.create({
      driverId: driverAProfile.id,
      category: VehicleCategory.SEDAN,
      registrationNumber: 'JH01-AB-1234',
      make: 'Maruti Suzuki',
      model: 'Dzire VXi',
      color: 'White',
      year: 2023,
      seatingCapacity: 4,
      isAc: true,
      rcNumber: 'RC-JH01-1234-2023',
      isVerified: true,
      isActive: true
    });

    await db.driverAvailability.upsert(driverAProfile.id, {
      isOnline: true,
      currentLatitude: 23.3441,
      currentLongitude: 85.3096
    });

    // Seed Driver A wallet with ₹1200
    const walletA = await db.wallets.findByUserId(driverAUser.id);
    await db.wallets.updateBalance(walletA.id, 1200.0, 'CREDIT');

    logger.info(`Test Driver A (Creator) seeded: Suresh Mahto (${driverAPhone}) with ₹1200 Wallet Balance`);
  }

  // 4. Test Driver B (Ramesh Kumar - Patna) - Verified
  const driverBPhone = '+919876500003';
  let driverBUser = await db.users.findByPhone(driverBPhone);
  if (!driverBUser) {
    driverBUser = await db.users.create({
      phone: driverBPhone,
      email: 'ramesh.driver@gatigo.in',
      name: 'Ramesh Kumar (Driver B)',
      preferredLanguage: 'hi',
      role: UserRole.DRIVER,
      isActive: true,
      isVerified: true
    });

    const driverBProfile = await db.driverProfiles.create({
      userId: driverBUser.id,
      licenseNumber: 'BR0120190089123',
      experienceYears: 5,
      kycStatus: KycStatus.VERIFIED,
      serviceCity: 'Patna',
      operatingState: 'Bihar',
      ratingAverage: 4.92,
      totalCompletedTrips: 180,
      totalSharedCreated: 2,
      totalSharedFulfilled: 38,
      bankAccountHolder: 'Ramesh Kumar',
      bankAccountNumber: '381920491823',
      bankIfscCode: 'PUNB0005678',
      upiId: 'rameshkumar@okaxis'
    });

    await db.vehicles.create({
      driverId: driverBProfile.id,
      category: VehicleCategory.SEDAN,
      registrationNumber: 'BR01-CD-5678',
      make: 'Hyundai',
      model: 'Aura SX',
      color: 'Silver',
      year: 2023,
      seatingCapacity: 4,
      isAc: true,
      rcNumber: 'RC-BR01-5678-2023',
      isVerified: true,
      isActive: true
    });

    await db.driverAvailability.upsert(driverBProfile.id, {
      isOnline: true,
      currentLatitude: 25.6120,
      currentLongitude: 85.1010
    });

    // Seed Driver B wallet with ₹850 (eligible for accepting shared rides >= ₹500)
    const walletB = await db.wallets.findByUserId(driverBUser.id);
    await db.wallets.updateBalance(walletB.id, 850.0, 'CREDIT');

    logger.info(`Test Driver B (Recipient) seeded: Ramesh Kumar (${driverBPhone}) with ₹850 Wallet Balance`);
  }

  // 5. Test Driver C (Vikram Singh - Jamshedpur) - Pending KYC Review
  const driverCPhone = '+919876500004';
  let driverCUser = await db.users.findByPhone(driverCPhone);
  if (!driverCUser) {
    driverCUser = await db.users.create({
      phone: driverCPhone,
      name: 'Vikram Singh (Driver C - Pending)',
      preferredLanguage: 'en',
      role: UserRole.DRIVER,
      isActive: true,
      isVerified: false
    });

    const driverCProfile = await db.driverProfiles.create({
      userId: driverCUser.id,
      licenseNumber: 'JH0520210011223',
      experienceYears: 2,
      kycStatus: KycStatus.UNDER_REVIEW,
      serviceCity: 'Jamshedpur',
      operatingState: 'Jharkhand',
      ratingAverage: 5.0,
      totalCompletedTrips: 0,
      totalSharedCreated: 0,
      totalSharedFulfilled: 0
    });

    await db.driverDocuments.create({
      driverId: driverCProfile.id,
      documentType: 'DRIVING_LICENSE_FRONT',
      fileUrl: 'https://storage.gatigo.in/kyc/vikram_dl_front.jpg',
      documentNumber: 'JH0520210011223',
      verificationStatus: 'PENDING'
    });

    await db.vehicles.create({
      driverId: driverCProfile.id,
      category: VehicleCategory.SUV,
      registrationNumber: 'JH05-XY-9999',
      make: 'Mahindra',
      model: 'Bolero Neo',
      color: 'White',
      year: 2022,
      seatingCapacity: 6,
      isAc: true,
      isVerified: false,
      isActive: true
    });

    logger.info(`Test Driver C (Pending KYC) seeded: Vikram Singh (${driverCPhone})`);
  }

  logger.info('Database seed completed successfully.');
}
