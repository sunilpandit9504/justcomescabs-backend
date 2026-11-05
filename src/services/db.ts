import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { UserRole, KycStatus, VehicleCategory, BookingStatus, BookingSource, BookingType, OfflineChannelSource, SharingMode, CommissionType, PaymentMethod, PaymentStatus, WalletTransactionType, PayoutStatus } from '@gatigo/shared';

export interface UserEntity {
  id: string;
  phone: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  preferredLanguage: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerProfileEntity {
  id: string;
  userId: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  ratingAverage: number;
  totalTrips: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverProfileEntity {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseExpiry?: Date;
  experienceYears: number;
  kycStatus: KycStatus;
  kycRejectionReason?: string;
  serviceCity: string;
  operatingState: string;
  ratingAverage: number;
  totalCompletedTrips: number;
  totalSharedCreated: number;
  totalSharedFulfilled: number;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  upiId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleEntity {
  id: string;
  driverId: string;
  category: VehicleCategory;
  registrationNumber: string;
  make: string;
  model: string;
  color: string;
  year: number;
  seatingCapacity: number;
  isAc: boolean;
  rcNumber?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverDocumentEntity {
  id: string;
  driverId: string;
  documentType: string;
  fileUrl: string;
  documentNumber?: string;
  expiryDate?: Date;
  verificationStatus: string;
  reviewerNotes?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

export interface DriverAvailabilityEntity {
  id: string;
  driverId: string;
  isOnline: boolean;
  currentLatitude: number;
  currentLongitude: number;
  heading?: number;
  speedKmh?: number;
  lastPingAt: Date;
}

export interface BookingEntity {
  id: string;
  bookingCode: string;
  bookingSource: BookingSource;
  bookingType: BookingType;
  status: BookingStatus;
  customerId?: string;
  creatorDriverId?: string;
  assignedDriverId?: string;
  assignedVehicleId?: string;
  vehicleCategory: VehicleCategory;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  scheduledPickupTime: Date;
  startTime?: Date;
  endTime?: Date;
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  actualDistanceKm?: number;
  actualDurationMinutes?: number;
  estimatedFare: number;
  finalFare?: number;
  advancePaid: number;
  remainingCustomerBalance: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  rideOtp?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineBookingDetailEntity {
  id: string;
  bookingId: string;
  offlineCustomerName: string;
  offlineCustomerPhone: string;
  channelSource: OfflineChannelSource;
  specialInstructions?: string;
  customerNotes?: string;
  luggageCount: number;
  returnDateTime?: Date;
  isAdvanceVerified: boolean;
  advancePaymentMethod?: string;
  createdAt: Date;
}

export interface RideSharingRequestEntity {
  id: string;
  bookingId: string;
  creatorDriverId: string;
  sharingMode: SharingMode;
  directTargetDriverId?: string;
  agreedCommissionType: CommissionType;
  agreedCommissionValue: number;
  computedCommissionAmount: number;
  expectedDriverBEarnings: number;
  platformFee: number;
  status: 'OFFERED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED_BY_CREATOR' | 'REVOKED';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommissionAgreementEntity {
  id: string;
  bookingId: string;
  creatorDriverId: string;
  assignedDriverId: string;
  totalFare: number;
  advanceCollectedByCreator: number;
  creatorCommissionAmount: number;
  platformFeeAmount: number;
  assignedDriverNetEarnings: number;
  settlementStatus: 'PENDING_COMPLETION' | 'SETTLED' | 'DISPUTED' | 'REVERSED';
  settledAt?: Date;
  createdAt: Date;
}

export interface WalletEntity {
  id: string;
  userId: string;
  currency: string;
  balance: number;
  lockedBalance: number;
  isFrozen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransactionEntity {
  id: string;
  walletId: string;
  idempotencyKey: string;
  referenceBookingId?: string;
  type: WalletTransactionType;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: 'PENDING' | 'SETTLED' | 'FAILED' | 'REVERSED';
  description: string;
  metadata?: any;
  createdAt: Date;
}

export interface PayoutEntity {
  id: string;
  driverId: string;
  amount: number;
  status: PayoutStatus;
  bankReferenceId?: string;
  payoutChannel: string;
  failureReason?: string;
  requestedAt: Date;
  settledAt?: Date;
}

export interface AdminUserEntity {
  id: string;
  userId: string;
  department: string;
  passwordHash: string;
  twoFaSecret?: string;
  createdAt: Date;
}

export interface SavedAddressEntity {
  id: string;
  customerId: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

export interface NotificationEntity {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

export interface AuditLogEntity {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: any;
  createdAt: Date;
}

export interface ZoneEntity {
  id: string;
  name: string;
  district: string;
  state: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  surgeMultiplier: number;
  activeDrivers: number;
  isActive: boolean;
  landmarks?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type AllowedServiceType = 'RIDE' | 'DELIVERY' | 'BOTH';

export interface VehicleModelEntity {
  id: string;
  make: string;
  model: string;
  vehicleType: string; // 'BIKE' | 'AUTO' | 'HATCHBACK' | 'SEDAN' | 'SUV' | 'DELIVERY_VAN'
  allowedServiceType: AllowedServiceType;
  seatingCapacity: number;
  baseFare: number;
  perKmRate: number;
  minFare: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class InMemoryDatabase {
  public users = new Map<string, UserEntity>();
  public customerProfiles = new Map<string, CustomerProfileEntity>();
  public driverProfiles = new Map<string, DriverProfileEntity>();
  public vehicles = new Map<string, VehicleEntity>();
  public driverDocuments = new Map<string, DriverDocumentEntity>();
  public driverAvailability = new Map<string, DriverAvailabilityEntity>();
  public savedAddresses = new Map<string, SavedAddressEntity>();
  public bookings = new Map<string, BookingEntity>();
  public offlineBookingDetails = new Map<string, OfflineBookingDetailEntity>();
  public rideSharingRequests = new Map<string, RideSharingRequestEntity>();
  public commissionAgreements = new Map<string, CommissionAgreementEntity>();
  public wallets = new Map<string, WalletEntity>();
  public walletTransactions = new Map<string, WalletTransactionEntity>();
  public payouts = new Map<string, PayoutEntity>();
  public adminUsers = new Map<string, AdminUserEntity>();
  public notifications = new Map<string, NotificationEntity>();
  public auditLogs: AuditLogEntity[] = [];
  public zones = new Map<string, ZoneEntity>();
  public vehicleModels = new Map<string, VehicleModelEntity>();

  private dbFilePath = path.resolve(process.cwd(), 'data', 'db.json');
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.initDefaultZones();
    this.initDefaultVehicleModels();
    this.loadFromDisk();
  }

  public scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveToDisk();
    }, 400);
  }

  public saveToDisk() {
    try {
      const candidates = [
        path.resolve(process.cwd(), 'data', 'db.json'),
        path.resolve(__dirname, '..', '..', 'data', 'db.json')
      ];
      const data = {
        users: Array.from(this.users.entries()),
        customerProfiles: Array.from(this.customerProfiles.entries()),
        driverProfiles: Array.from(this.driverProfiles.entries()),
        vehicles: Array.from(this.vehicles.entries()),
        driverDocuments: Array.from(this.driverDocuments.entries()),
        driverAvailability: Array.from(this.driverAvailability.entries()),
        savedAddresses: Array.from(this.savedAddresses.entries()),
        bookings: Array.from(this.bookings.entries()),
        offlineBookingDetails: Array.from(this.offlineBookingDetails.entries()),
        rideSharingRequests: Array.from(this.rideSharingRequests.entries()),
        commissionAgreements: Array.from(this.commissionAgreements.entries()),
        wallets: Array.from(this.wallets.entries()),
        walletTransactions: Array.from(this.walletTransactions.entries()),
        payouts: Array.from(this.payouts.entries()),
        adminUsers: Array.from(this.adminUsers.entries()),
        notifications: Array.from(this.notifications.entries()),
        auditLogs: this.auditLogs,
        zones: Array.from(this.zones.entries()),
        vehicleModels: Array.from(this.vehicleModels.entries())
      };
      const jsonStr = JSON.stringify(data, null, 2);
      for (const targetPath of candidates) {
        try {
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(targetPath, jsonStr, 'utf-8');
        } catch (_) {}
      }
    } catch (err) {
      console.error('Failed to save database to disk:', err);
    }
  }

  public loadFromDisk() {
    try {
      const candidates = [
        path.resolve(process.cwd(), 'data', 'db.json'),
        path.resolve(__dirname, '..', '..', 'data', 'db.json')
      ];
      const targetPath = candidates.find(p => fs.existsSync(p));
      if (targetPath) {
        const raw = fs.readFileSync(targetPath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.users && Array.isArray(data.users)) this.users = new Map(data.users);
        if (data.customerProfiles && Array.isArray(data.customerProfiles)) this.customerProfiles = new Map(data.customerProfiles);
        if (data.driverProfiles && Array.isArray(data.driverProfiles)) this.driverProfiles = new Map(data.driverProfiles);
        if (data.vehicles && Array.isArray(data.vehicles)) this.vehicles = new Map(data.vehicles);
        if (data.driverDocuments && Array.isArray(data.driverDocuments)) this.driverDocuments = new Map(data.driverDocuments);
        if (data.driverAvailability && Array.isArray(data.driverAvailability)) this.driverAvailability = new Map(data.driverAvailability);
        if (data.savedAddresses && Array.isArray(data.savedAddresses)) this.savedAddresses = new Map(data.savedAddresses);
        if (data.bookings && Array.isArray(data.bookings)) this.bookings = new Map(data.bookings);
        if (data.offlineBookingDetails && Array.isArray(data.offlineBookingDetails)) this.offlineBookingDetails = new Map(data.offlineBookingDetails);
        if (data.rideSharingRequests && Array.isArray(data.rideSharingRequests)) this.rideSharingRequests = new Map(data.rideSharingRequests);
        if (data.commissionAgreements && Array.isArray(data.commissionAgreements)) this.commissionAgreements = new Map(data.commissionAgreements);
        if (data.wallets && Array.isArray(data.wallets)) this.wallets = new Map(data.wallets);
        if (data.walletTransactions && Array.isArray(data.walletTransactions)) this.walletTransactions = new Map(data.walletTransactions);
        if (data.payouts && Array.isArray(data.payouts)) this.payouts = new Map(data.payouts);
        if (data.adminUsers && Array.isArray(data.adminUsers)) this.adminUsers = new Map(data.adminUsers);
        if (data.notifications && Array.isArray(data.notifications)) this.notifications = new Map(data.notifications);
        if (data.auditLogs && Array.isArray(data.auditLogs)) this.auditLogs = data.auditLogs;
        if (data.zones && Array.isArray(data.zones) && data.zones.length > 0) this.zones = new Map(data.zones);
        if (data.vehicleModels && Array.isArray(data.vehicleModels) && data.vehicleModels.length > 0) this.vehicleModels = new Map(data.vehicleModels);
      }
    } catch (err) {
      console.error('Failed to load database from disk:', err);
    }
  }

  public initDefaultZones() {
    const defaults: ZoneEntity[] = [
      // 1. Godda Sadar Block
      {
        id: 'zone-godda-sadar',
        name: 'Godda Sadar Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 24.8267,
        centerLongitude: 87.2156,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 20,
        isActive: true,
        landmarks: ['Godda Bus Stand', 'Rautara Chowk', 'Bhatdiha', 'Sikatiya', 'Kargil Chowk'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 2. Mahagama Block
      {
        id: 'zone-godda-mahagama',
        name: 'Mahagama Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 25.0253,
        centerLongitude: 87.3117,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 15,
        isActive: true,
        landmarks: ['Mahagama Main Bazar', 'Urjanagar ECL Colony', 'Rajmahal OCP', 'Kankhor'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 3. Pathargama Block
      {
        id: 'zone-godda-pathargama',
        name: 'Pathargama Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 24.9515,
        centerLongitude: 87.2721,
        radiusKm: 10,
        surgeMultiplier: 1.0,
        activeDrivers: 12,
        isActive: true,
        landmarks: ['Gandhi Chowk', 'Pipra Village', 'Barahat Link', 'Maheshpur', 'Korla'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 4. Poreyahat Block
      {
        id: 'zone-godda-poreyahat',
        name: 'Poreyahat Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 24.6321,
        centerLongitude: 87.1642,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 14,
        isActive: true,
        landmarks: ['Poreyahat Chowk', 'Hansdiha Junction', 'Barmasia', 'Dumka Highway'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 5. Boarijor (Lalmatia) Block
      {
        id: 'zone-godda-boarijor',
        name: 'Boarijor (Lalmatia) Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 25.0418,
        centerLongitude: 87.4812,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 10,
        isActive: true,
        landmarks: ['Lalmatia Coal Hub', 'Bada Boarijor', 'Simra', 'ECL Mining Area'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 6. Meharma Block
      {
        id: 'zone-godda-meharma',
        name: 'Meharma Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 25.1952,
        centerLongitude: 87.3512,
        radiusKm: 10,
        surgeMultiplier: 1.0,
        activeDrivers: 9,
        isActive: true,
        landmarks: ['Meharma Main Bazar', 'Bhagaiya', 'Belbadda', 'Pirpainti Border Link'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 7. Thakur Gangti Block
      {
        id: 'zone-godda-thakurgangti',
        name: 'Thakur Gangti Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 25.1524,
        centerLongitude: 87.4215,
        radiusKm: 10,
        surgeMultiplier: 1.0,
        activeDrivers: 8,
        isActive: true,
        landmarks: ['Thakur Gangti Chowk', 'Mirzapur', 'Ranga', 'Kahalgaon Border'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 8. Sundarpahari Block
      {
        id: 'zone-godda-sundarpahari',
        name: 'Sundarpahari Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 24.7512,
        centerLongitude: 87.3541,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 8,
        isActive: true,
        landmarks: ['Sundarpahari Chowk', 'Damru', 'Chandana', 'Tilabhita Tribal Belt'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 9. Basantrai Block
      {
        id: 'zone-godda-basantrai',
        name: 'Basantrai Block Hub',
        district: 'Godda',
        state: 'Jharkhand',
        centerLatitude: 24.9921,
        centerLongitude: 87.1518,
        radiusKm: 10,
        surgeMultiplier: 1.0,
        activeDrivers: 7,
        isActive: true,
        landmarks: ['Basantrai Historic Pokhar', 'Sanjha Chowk', 'Kadma', 'Maheshlitola'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 10. Deoghar Pilgrimage & Smart City Hub
      {
        id: 'zone-deoghar',
        name: 'Deoghar Pilgrimage & Smart City Hub',
        district: 'Deoghar',
        state: 'Jharkhand',
        centerLatitude: 24.4826,
        centerLongitude: 86.7000,
        radiusKm: 25,
        surgeMultiplier: 1.0,
        activeDrivers: 24,
        isActive: true,
        landmarks: ['Baba Baidyanath Temple', 'Jasidih Junction', 'Deoghar Airport', 'Tower Chowk'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Sahebganj District (All 9 Blocks)
      // 1. Sahebganj Sadar Block
      {
        id: 'zone-sahebganj-sadar',
        name: 'Sahebganj Sadar Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 25.2425,
        centerLongitude: 87.6433,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 20,
        isActive: true,
        landmarks: ['Ganga Multi-Modal Port', 'Sahebganj Railway Jn', 'Sakrigali Ghat', 'Chowk Bazar'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 2. Rajmahal Block
      {
        id: 'zone-sahebganj-rajmahal',
        name: 'Rajmahal Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 25.0500,
        centerLongitude: 87.8400,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 15,
        isActive: true,
        landmarks: ['Rajmahal Ferry Ghat', 'Singhi Dalan', 'Neelkanth Mahadev', 'Historic Capital Ruins', 'Mangalhat'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 3. Barharwa Block
      {
        id: 'zone-sahebganj-barharwa',
        name: 'Barharwa Junction Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 24.8569,
        centerLongitude: 87.7788,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 18,
        isActive: true,
        landmarks: ['Barharwa Railway Junction', 'Bindu Dham Temple', 'Main Cloth Market', 'Kankjol', 'Pakur Link'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 4. Barhait Block
      {
        id: 'zone-sahebganj-barhait',
        name: 'Barhait Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 24.8967,
        centerLongitude: 87.6083,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 12,
        isActive: true,
        landmarks: ['Bhognadih (Sido-Kanhu Memorial)', 'Barhait Bazar', 'Kadamgachi', 'Gopikandar Link'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 5. Borio Block
      {
        id: 'zone-sahebganj-borio',
        name: 'Borio Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 25.0450,
        centerLongitude: 87.6480,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 10,
        isActive: true,
        landmarks: ['Borio Block Chowk', 'Borio Main Hatia', 'Chhata Pahari', 'Rakshi'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 6. Mandro Block
      {
        id: 'zone-sahebganj-mandro',
        name: 'Mandro (Fossil Park) Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 25.1380,
        centerLongitude: 87.5620,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 10,
        isActive: true,
        landmarks: ['Mandro Fossil Park & Geo Site', 'Mirza Chowki Border', 'Teliagarhi Pass', 'Karamtola'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 7. Taljhari Block
      {
        id: 'zone-sahebganj-taljhari',
        name: 'Taljhari (Motijharna) Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 25.0780,
        centerLongitude: 87.7550,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 9,
        isActive: true,
        landmarks: ['Motijharna Waterfall', 'Taljhari Railway Station', 'Maharajpur', 'Karanpura'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 8. Udhwa Block
      {
        id: 'zone-sahebganj-udhwa',
        name: 'Udhwa (Bird Sanctuary) Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 24.9820,
        centerLongitude: 87.8680,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 11,
        isActive: true,
        landmarks: ['Udhwa Lake Bird Sanctuary (Berhale/Pataura)', 'Radhanagar Bazar', 'Ganga Diara', 'Farakka Link'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 9. Pathna Block
      {
        id: 'zone-sahebganj-pathna',
        name: 'Pathna Block Hub',
        district: 'Sahebganj',
        state: 'Jharkhand',
        centerLatitude: 24.8870,
        centerLongitude: 87.7020,
        radiusKm: 10,
        surgeMultiplier: 1.0,
        activeDrivers: 8,
        isActive: true,
        landmarks: ['Pathna Block HQ', 'Dharampur Chowk', 'Khendi', 'Hiranpur Link Road'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Pakur District (All 6 Blocks)
      // 1. Pakur Sadar Block
      {
        id: 'zone-pakur-sadar',
        name: 'Pakur Sadar Block Hub',
        district: 'Pakur',
        state: 'Jharkhand',
        centerLatitude: 24.6333,
        centerLongitude: 87.8489,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 20,
        isActive: true,
        landmarks: ['Pakur Railway Station', 'Birsa Chowk', 'Harindanga Bazar', 'Stone Industrial Belt', 'Rani Jyotirmoyee Stadium'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 2. Hiranpur Block
      {
        id: 'zone-pakur-hiranpur',
        name: 'Hiranpur Block Hub',
        district: 'Pakur',
        state: 'Jharkhand',
        centerLatitude: 24.7042,
        centerLongitude: 87.7125,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 14,
        isActive: true,
        landmarks: ['Hiranpur Main Haat & Cattle Market', 'Hatkathia', 'Mohanpur', 'Pakur-Dumka Link'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 3. Maheshpur Block
      {
        id: 'zone-pakur-maheshpur',
        name: 'Maheshpur Block Hub',
        district: 'Pakur',
        state: 'Jharkhand',
        centerLatitude: 24.4756,
        centerLongitude: 87.7558,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 15,
        isActive: true,
        landmarks: ['Maheshpur Historical Rajbari Palace', 'Bansloi River Bridge', 'Rohinpur', 'Murshidabad Border Link'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 4. Littipara Block
      {
        id: 'zone-pakur-littipara',
        name: 'Littipara Block Hub',
        district: 'Pakur',
        state: 'Jharkhand',
        centerLatitude: 24.6983,
        centerLongitude: 87.6186,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 10,
        isActive: true,
        landmarks: ['Littipara Block Chowk', 'Dharampur Link', 'Paharia Cultural Belt', 'Simlong Mining Area'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 5. Amrapara Block
      {
        id: 'zone-pakur-amrapara',
        name: 'Amrapara Block Hub',
        district: 'Pakur',
        state: 'Jharkhand',
        centerLatitude: 24.5217,
        centerLongitude: 87.5683,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 11,
        isActive: true,
        landmarks: ['Amrapara Main Bazar', 'Bansloi River Valley', 'Pachwara Coal Hub', 'Dumka Link Highway'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // 6. Pakuria Block
      {
        id: 'zone-pakur-pakuria',
        name: 'Pakuria Block Hub',
        district: 'Pakur',
        state: 'Jharkhand',
        centerLatitude: 24.3317,
        centerLongitude: 87.6717,
        radiusKm: 12,
        surgeMultiplier: 1.0,
        activeDrivers: 9,
        isActive: true,
        landmarks: ['Pakuria Block Chowk', 'Shikaripara Link Road', 'Radhanagar', 'Rampurhat/WB Border Link'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const z of defaults) {
      this.zones.set(z.id, z);
    }
  }

  public initDefaultVehicleModels() {
    const models: VehicleModelEntity[] = [
      // 1. Maruti Suzuki
      {
        id: 'vm-maruti-dzire',
        make: 'Maruti Suzuki',
        model: 'Dzire Tour',
        vehicleType: 'SEDAN',
        allowedServiceType: 'RIDE',
        seatingCapacity: 4,
        baseFare: 70,
        perKmRate: 17,
        minFare: 90,
        description: 'Commercial AC sedan for passenger cab rides',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-maruti-ertiga',
        make: 'Maruti Suzuki',
        model: 'Ertiga',
        vehicleType: 'SUV',
        allowedServiceType: 'RIDE',
        seatingCapacity: 6,
        baseFare: 100,
        perKmRate: 22,
        minFare: 140,
        description: 'Spacious 6-seater premium SUV for family & outstation rides',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-maruti-wagonr',
        make: 'Maruti Suzuki',
        model: 'WagonR',
        vehicleType: 'HATCHBACK',
        allowedServiceType: 'BOTH',
        seatingCapacity: 4,
        baseFare: 50,
        perKmRate: 14,
        minFare: 60,
        description: 'Tall-boy economy car eligible for both Passenger Rides & Parcel Deliveries',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-maruti-swift',
        make: 'Maruti Suzuki',
        model: 'Swift',
        vehicleType: 'HATCHBACK',
        allowedServiceType: 'RIDE',
        seatingCapacity: 4,
        baseFare: 50,
        perKmRate: 14,
        minFare: 60,
        description: 'Economy AC hatchback for city passenger trips',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-maruti-supercarry',
        make: 'Maruti Suzuki',
        model: 'Super Carry Mini Truck',
        vehicleType: 'DELIVERY_VAN',
        allowedServiceType: 'DELIVERY',
        seatingCapacity: 2,
        baseFare: 120,
        perKmRate: 25,
        minFare: 160,
        description: 'Mini truck dedicated for Courier, Cargo & Goods Delivery only',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 2. Tata Motors
      {
        id: 'vm-tata-tiago',
        make: 'Tata Motors',
        model: 'Tiago',
        vehicleType: 'HATCHBACK',
        allowedServiceType: 'RIDE',
        seatingCapacity: 4,
        baseFare: 50,
        perKmRate: 14,
        minFare: 60,
        description: 'Safe and comfortable city hatchback',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-tata-tigor',
        make: 'Tata Motors',
        model: 'Tigor',
        vehicleType: 'SEDAN',
        allowedServiceType: 'RIDE',
        seatingCapacity: 4,
        baseFare: 70,
        perKmRate: 17,
        minFare: 90,
        description: 'Compact sedan with large trunk',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-tata-nexon',
        make: 'Tata Motors',
        model: 'Nexon',
        vehicleType: 'SUV',
        allowedServiceType: 'RIDE',
        seatingCapacity: 5,
        baseFare: 90,
        perKmRate: 20,
        minFare: 130,
        description: '5-star safety compact SUV for long distances',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-tata-ace',
        make: 'Tata Motors',
        model: 'Ace Gold (Chota Hathi)',
        vehicleType: 'DELIVERY_VAN',
        allowedServiceType: 'DELIVERY',
        seatingCapacity: 2,
        baseFare: 150,
        perKmRate: 26,
        minFare: 200,
        description: 'India top commercial mini truck for parcel and logistics delivery',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 3. Hyundai
      {
        id: 'vm-hyundai-aura',
        make: 'Hyundai',
        model: 'Aura',
        vehicleType: 'SEDAN',
        allowedServiceType: 'RIDE',
        seatingCapacity: 4,
        baseFare: 70,
        perKmRate: 17,
        minFare: 90,
        description: 'Modern styling and smooth city ride comfort',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-hyundai-i10',
        make: 'Hyundai',
        model: 'Grand i10 Nios',
        vehicleType: 'HATCHBACK',
        allowedServiceType: 'RIDE',
        seatingCapacity: 4,
        baseFare: 50,
        perKmRate: 14,
        minFare: 60,
        description: 'Agile city hatchback for easy traffic navigation',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-hyundai-creta',
        make: 'Hyundai',
        model: 'Creta',
        vehicleType: 'SUV',
        allowedServiceType: 'RIDE',
        seatingCapacity: 5,
        baseFare: 110,
        perKmRate: 23,
        minFare: 150,
        description: 'Premium SUV for executive passenger transport',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 4. Mahindra
      {
        id: 'vm-mahindra-bolero',
        make: 'Mahindra',
        model: 'Bolero',
        vehicleType: 'SUV',
        allowedServiceType: 'BOTH',
        seatingCapacity: 7,
        baseFare: 100,
        perKmRate: 22,
        minFare: 150,
        description: 'Rugged rural workhorse authorized for both Passenger Rides & Cargo Deliveries',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-mahindra-scorpio',
        make: 'Mahindra',
        model: 'Scorpio Classic',
        vehicleType: 'SUV',
        allowedServiceType: 'RIDE',
        seatingCapacity: 7,
        baseFare: 120,
        perKmRate: 24,
        minFare: 170,
        description: 'Powerful SUV for rugged highways and passenger groups',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-mahindra-maxitruck',
        make: 'Mahindra',
        model: 'Bolero Maxi Truck',
        vehicleType: 'DELIVERY_VAN',
        allowedServiceType: 'DELIVERY',
        seatingCapacity: 2,
        baseFare: 180,
        perKmRate: 28,
        minFare: 240,
        description: 'Heavy payload transport truck for freight & parcel shipments',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-mahindra-treo',
        make: 'Mahindra',
        model: 'Treo Electric Auto',
        vehicleType: 'AUTO',
        allowedServiceType: 'BOTH',
        seatingCapacity: 3,
        baseFare: 30,
        perKmRate: 10,
        minFare: 40,
        description: 'Zero emission EV 3-wheeler for Passenger Rides & Parcel Drop-offs',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 5. Toyota
      {
        id: 'vm-toyota-innova',
        make: 'Toyota',
        model: 'Innova Crysta',
        vehicleType: 'SUV',
        allowedServiceType: 'RIDE',
        seatingCapacity: 7,
        baseFare: 150,
        perKmRate: 28,
        minFare: 220,
        description: 'Flagship luxury MPV for long-distance luxury group travel',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 6. Honda
      {
        id: 'vm-honda-amaze',
        make: 'Honda',
        model: 'Amaze',
        vehicleType: 'SEDAN',
        allowedServiceType: 'RIDE',
        seatingCapacity: 4,
        baseFare: 70,
        perKmRate: 17,
        minFare: 90,
        description: 'Refined sedan with premium legroom',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-honda-activa',
        make: 'Honda',
        model: 'Activa 6G Scooter',
        vehicleType: 'BIKE',
        allowedServiceType: 'BOTH',
        seatingCapacity: 1,
        baseFare: 20,
        perKmRate: 7,
        minFare: 25,
        description: 'Reliable 2-wheeler for Bike Taxi Rides and Courier Deliveries',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 7. Hero MotoCorp
      {
        id: 'vm-hero-splendor',
        make: 'Hero MotoCorp',
        model: 'Splendor Plus',
        vehicleType: 'BIKE',
        allowedServiceType: 'BOTH',
        seatingCapacity: 1,
        baseFare: 20,
        perKmRate: 7,
        minFare: 25,
        description: 'High mileage bike for quick Bike Rides and Express Parcel Drops',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-hero-hfdeluxe',
        make: 'Hero MotoCorp',
        model: 'HF Deluxe',
        vehicleType: 'BIKE',
        allowedServiceType: 'DELIVERY',
        seatingCapacity: 1,
        baseFare: 20,
        perKmRate: 7,
        minFare: 25,
        description: 'Dedicated 2-wheeler delivery vehicle for ecommerce & food delivery',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 8. Bajaj Auto
      {
        id: 'vm-bajaj-compact',
        make: 'Bajaj Auto',
        model: 'Compact 4S Auto Rickshaw',
        vehicleType: 'AUTO',
        allowedServiceType: 'BOTH',
        seatingCapacity: 3,
        baseFare: 30,
        perKmRate: 11,
        minFare: 40,
        description: 'Standard Indian 3-wheeler for Passenger Shared Rides and Market Deliveries',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-bajaj-pulsar',
        make: 'Bajaj Auto',
        model: 'Pulsar 150',
        vehicleType: 'BIKE',
        allowedServiceType: 'BOTH',
        seatingCapacity: 1,
        baseFare: 25,
        perKmRate: 8,
        minFare: 30,
        description: 'Fast commuter motorcycle for Bike Taxi and Quick Deliveries',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 9. TVS Motors
      {
        id: 'vm-tvs-king',
        make: 'TVS Motors',
        model: 'King Deluxe Auto',
        vehicleType: 'AUTO',
        allowedServiceType: 'BOTH',
        seatingCapacity: 3,
        baseFare: 30,
        perKmRate: 11,
        minFare: 40,
        description: 'Comfortable auto rickshaw for rides and parcel delivery',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // 10. Piaggio
      {
        id: 'vm-piaggio-apecity',
        make: 'Piaggio',
        model: 'Ape City Plus Auto',
        vehicleType: 'AUTO',
        allowedServiceType: 'BOTH',
        seatingCapacity: 3,
        baseFare: 30,
        perKmRate: 11,
        minFare: 40,
        description: 'Heavy-duty 3-wheeler for city passenger rides and parcel cargo',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'vm-piaggio-apecargo',
        make: 'Piaggio',
        model: 'Ape Xtra LDX Cargo',
        vehicleType: 'DELIVERY_VAN',
        allowedServiceType: 'DELIVERY',
        seatingCapacity: 1,
        baseFare: 90,
        perKmRate: 19,
        minFare: 120,
        description: 'Three wheeler cargo loader for goods and parcel deliveries only',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const m of models) {
      this.vehicleModels.set(m.id, m);
    }
  }

  // Helper Finders
  public findUserByPhone(phone: string): UserEntity | undefined {
    if (!phone) return undefined;
    const rawClean = phone.replace(/\D/g, '');
    const cleanLast10 = rawClean.slice(-10);
    for (const u of this.users.values()) {
      if (u.phone === phone) return u;
      const uClean = u.phone ? u.phone.replace(/\D/g, '') : '';
      if (cleanLast10 && cleanLast10.length >= 10 && uClean.endsWith(cleanLast10)) {
        return u;
      }
    }
    return undefined;
  }

  public findUserByEmail(email: string): UserEntity | undefined {
    for (const u of this.users.values()) {
      if (u.email?.toLowerCase() === email.toLowerCase()) return u;
    }
    return undefined;
  }

  public findCustomerByUserId(userId: string): CustomerProfileEntity | undefined {
    for (const c of this.customerProfiles.values()) {
      if (c.userId === userId) return c;
    }
    return undefined;
  }

  public findDriverByUserId(userId: string): DriverProfileEntity | undefined {
    for (const d of this.driverProfiles.values()) {
      if (d.userId === userId) return d;
    }
    return undefined;
  }

  public findAdminByUserId(userId: string): AdminUserEntity | undefined {
    for (const a of this.adminUsers.values()) {
      if (a.userId === userId) return a;
    }
    return undefined;
  }

  public findWalletByUserId(userId: string): WalletEntity | undefined {
    for (const w of this.wallets.values()) {
      if (w.userId === userId) return w;
    }
    return undefined;
  }

  public getOrCreateWallet(userId: string): WalletEntity {
    let wallet = this.findWalletByUserId(userId);
    if (!wallet) {
      wallet = {
        id: uuidv4(),
        userId,
        currency: 'INR',
        balance: 0.00,
        lockedBalance: 0.00,
        isFrozen: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.wallets.set(wallet.id, wallet);
      this.scheduleSave();
    }
    return wallet;
  }
}

export const inMemoryDb = new InMemoryDatabase();

// Clean DB Service facade
export const db = {
  users: {
    findById: async (id: string) => inMemoryDb.users.get(id),
    findByPhone: async (phone: string) => inMemoryDb.findUserByPhone(phone),
    findByEmail: async (email: string) => inMemoryDb.findUserByEmail(email),
    create: async (data: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const user: UserEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.users.set(user.id, user);
      inMemoryDb.scheduleSave();
      return user;
    },
    update: async (id: string, data: Partial<UserEntity>) => {
      const existing = inMemoryDb.users.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      inMemoryDb.users.set(id, updated);
      inMemoryDb.scheduleSave();
      return updated;
    },
    listAll: async () => Array.from(inMemoryDb.users.values())
  },

  customerProfiles: {
    findById: async (id: string) => inMemoryDb.customerProfiles.get(id),
    findByUserId: async (userId: string) => inMemoryDb.findCustomerByUserId(userId),
    create: async (data: Omit<CustomerProfileEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const profile: CustomerProfileEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.customerProfiles.set(profile.id, profile);
      inMemoryDb.scheduleSave();
      return profile;
    },
    update: async (id: string, data: Partial<CustomerProfileEntity>) => {
      const existing = inMemoryDb.customerProfiles.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      inMemoryDb.customerProfiles.set(id, updated);
      inMemoryDb.scheduleSave();
      return updated;
    }
  },

  driverProfiles: {
    findById: async (id: string) => {
      if (!id) return undefined;
      const cleanId = id.trim().replace(/^#/, '');
      // 1. Direct match by ID
      let profile = inMemoryDb.driverProfiles.get(cleanId) || inMemoryDb.driverProfiles.get(id);
      if (profile) return profile;
      // 2. Direct match by userId
      profile = inMemoryDb.findDriverByUserId(cleanId) || inMemoryDb.findDriverByUserId(id);
      if (profile) return profile;
      // 3. Match via user phone
      const user = inMemoryDb.findUserByPhone(cleanId);
      if (user) {
        profile = inMemoryDb.findDriverByUserId(user.id);
        if (profile) return profile;
      }
      // 4. Suffix or short ID match
      for (const d of inMemoryDb.driverProfiles.values()) {
        if (
          d.id.toLowerCase() === cleanId.toLowerCase() ||
          d.id.slice(-4).toLowerCase() === cleanId.toLowerCase() ||
          d.id.replace(/-/g, '').toLowerCase().endsWith(cleanId.toLowerCase())
        ) {
          return d;
        }
      }
      return undefined;
    },
    findByUserId: async (userId: string) => inMemoryDb.findDriverByUserId(userId),
    create: async (data: Omit<DriverProfileEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const profile: DriverProfileEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.driverProfiles.set(profile.id, profile);
      inMemoryDb.scheduleSave();
      return profile;
    },
    update: async (id: string, data: Partial<DriverProfileEntity>) => {
      let existing = inMemoryDb.driverProfiles.get(id);
      let targetKey = id;
      if (!existing) {
        const found = await db.driverProfiles.findById(id);
        if (found) {
          existing = found;
          targetKey = found.id;
        }
      }
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      inMemoryDb.driverProfiles.set(targetKey, updated);
      inMemoryDb.scheduleSave();
      return updated;
    },
    listPendingKyc: async () => {
      return Array.from(inMemoryDb.driverProfiles.values()).filter(d => d.kycStatus === KycStatus.PENDING || d.kycStatus === KycStatus.UNDER_REVIEW);
    },
    listAll: async () => Array.from(inMemoryDb.driverProfiles.values())
  },

  vehicles: {
    findById: async (id: string) => inMemoryDb.vehicles.get(id),
    findByDriverId: async (driverId: string) => {
      return Array.from(inMemoryDb.vehicles.values()).filter(v => v.driverId === driverId);
    },
    create: async (data: Omit<VehicleEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const vehicle: VehicleEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.vehicles.set(vehicle.id, vehicle);
      inMemoryDb.scheduleSave();
      return vehicle;
    },
    update: async (id: string, data: Partial<VehicleEntity>) => {
      const existing = inMemoryDb.vehicles.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      inMemoryDb.vehicles.set(id, updated);
      inMemoryDb.scheduleSave();
      return updated;
    }
  },

  driverDocuments: {
    findById: async (id: string) => inMemoryDb.driverDocuments.get(id),
    findByDriverId: async (driverId: string) => {
      return Array.from(inMemoryDb.driverDocuments.values()).filter(d => d.driverId === driverId);
    },
    create: async (data: Omit<DriverDocumentEntity, 'id' | 'createdAt'>) => {
      const doc: DriverDocumentEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date()
      };
      inMemoryDb.driverDocuments.set(doc.id, doc);
      inMemoryDb.scheduleSave();
      return doc;
    },
    update: async (id: string, data: Partial<DriverDocumentEntity>) => {
      const existing = inMemoryDb.driverDocuments.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      inMemoryDb.driverDocuments.set(id, updated);
      inMemoryDb.scheduleSave();
      return updated;
    }
  },

  driverAvailability: {
    findByDriverId: async (driverId: string) => inMemoryDb.driverAvailability.get(driverId),
    upsert: async (driverId: string, data: Partial<DriverAvailabilityEntity>) => {
      const existing = inMemoryDb.driverAvailability.get(driverId);
      if (existing) {
        const updated = { ...existing, ...data, lastPingAt: new Date() };
        inMemoryDb.driverAvailability.set(driverId, updated);
        inMemoryDb.scheduleSave();
        return updated;
      }
      const created: DriverAvailabilityEntity = {
        id: uuidv4(),
        driverId,
        isOnline: data.isOnline ?? false,
        currentLatitude: data.currentLatitude ?? 0,
        currentLongitude: data.currentLongitude ?? 0,
        heading: data.heading,
        speedKmh: data.speedKmh,
        lastPingAt: new Date()
      };
      inMemoryDb.driverAvailability.set(driverId, created);
      inMemoryDb.scheduleSave();
      return created;
    },
    findOnlineDriversNearby: async (lat: number, lng: number, maxDistanceKm = 15) => {
      const onlineDrivers = Array.from(inMemoryDb.driverAvailability.values()).filter(d => d.isOnline);
      return onlineDrivers;
    }
  },

  savedAddresses: {
    findByCustomerId: async (customerId: string) => {
      return Array.from(inMemoryDb.savedAddresses.values()).filter(a => a.customerId === customerId);
    },
    create: async (data: Omit<SavedAddressEntity, 'id' | 'createdAt'>) => {
      const address: SavedAddressEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date()
      };
      inMemoryDb.savedAddresses.set(address.id, address);
      return address;
    },
    delete: async (id: string) => {
      inMemoryDb.savedAddresses.delete(id);
    }
  },

  bookings: {
    findById: async (id: string) => inMemoryDb.bookings.get(id),
    findByCode: async (code: string) => {
      for (const b of inMemoryDb.bookings.values()) {
        if (b.bookingCode === code) return b;
      }
      return undefined;
    },
    findByCustomerId: async (customerId: string) => {
      return Array.from(inMemoryDb.bookings.values()).filter(b => b.customerId === customerId);
    },
    findByDriverId: async (driverId: string) => {
      return Array.from(inMemoryDb.bookings.values()).filter(b => b.assignedDriverId === driverId || b.creatorDriverId === driverId);
    },
    findOfflineCreatedByDriver: async (driverId: string) => {
      return Array.from(inMemoryDb.bookings.values()).filter(b => b.creatorDriverId === driverId && b.bookingSource === BookingSource.OFFLINE_DRIVER_BOOKING);
    },
    create: async (data: Omit<BookingEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const booking: BookingEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.bookings.set(booking.id, booking);
      return booking;
    },
    update: async (id: string, data: Partial<BookingEntity>) => {
      const existing = inMemoryDb.bookings.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      inMemoryDb.bookings.set(id, updated);
      return updated;
    },
    listAll: async () => Array.from(inMemoryDb.bookings.values())
  },

  offlineBookingDetails: {
    findByBookingId: async (bookingId: string) => {
      for (const d of inMemoryDb.offlineBookingDetails.values()) {
        if (d.bookingId === bookingId) return d;
      }
      return undefined;
    },
    create: async (data: Omit<OfflineBookingDetailEntity, 'id' | 'createdAt'>) => {
      const detail: OfflineBookingDetailEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date()
      };
      inMemoryDb.offlineBookingDetails.set(detail.id, detail);
      return detail;
    }
  },

  rideSharingRequests: {
    findById: async (id: string) => inMemoryDb.rideSharingRequests.get(id),
    findByBookingId: async (bookingId: string) => {
      for (const r of inMemoryDb.rideSharingRequests.values()) {
        if (r.bookingId === bookingId) return r;
      }
      return undefined;
    },
    findActiveOffersForDriver: async (driverId: string) => {
      const now = new Date();
      return Array.from(inMemoryDb.rideSharingRequests.values()).filter(r => {
        if (r.status !== 'OFFERED' || r.expiresAt <= now) return false;
        // Never show to the creator driver themselves
        if (r.creatorDriverId === driverId) return false;
        
        // If shared in DIRECT mode to a specific driver, only show to that target driver
        if ((r.sharingMode === SharingMode.DIRECT_OFFER || (r.sharingMode as string) === 'DIRECT_DRIVER') && r.directTargetDriverId) {
          return r.directTargetDriverId === driverId;
        }

        // Open Driver Network Pool: available to qualified peer drivers
        return true;
      });
    },
    findSharedByCreatorDriver: async (creatorDriverId: string) => {
      return Array.from(inMemoryDb.rideSharingRequests.values()).filter(r => r.creatorDriverId === creatorDriverId);
    },
    create: async (data: Omit<RideSharingRequestEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const req: RideSharingRequestEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.rideSharingRequests.set(req.id, req);
      return req;
    },
    update: async (id: string, data: Partial<RideSharingRequestEntity>) => {
      const existing = inMemoryDb.rideSharingRequests.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      inMemoryDb.rideSharingRequests.set(id, updated);
      return updated;
    }
  },

  commissionAgreements: {
    findByBookingId: async (bookingId: string) => {
      for (const ca of inMemoryDb.commissionAgreements.values()) {
        if (ca.bookingId === bookingId) return ca;
      }
      return undefined;
    },
    create: async (data: Omit<CommissionAgreementEntity, 'id' | 'createdAt'>) => {
      const ca: CommissionAgreementEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date()
      };
      inMemoryDb.commissionAgreements.set(ca.id, ca);
      return ca;
    },
    update: async (id: string, data: Partial<CommissionAgreementEntity>) => {
      const existing = inMemoryDb.commissionAgreements.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      inMemoryDb.commissionAgreements.set(id, updated);
      return updated;
    }
  },

  wallets: {
    findByUserId: async (userId: string) => inMemoryDb.getOrCreateWallet(userId),
    findById: async (id: string) => inMemoryDb.wallets.get(id),
    create: async (data: Omit<WalletEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const wallet: WalletEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.wallets.set(wallet.id, wallet);
      inMemoryDb.scheduleSave();
      return wallet;
    },
    updateBalance: async (walletId: string, amount: number, direction: 'CREDIT' | 'DEBIT') => {
      const wallet = inMemoryDb.wallets.get(walletId);
      if (!wallet) throw new Error('Wallet not found');
      const balanceBefore = Number(wallet.balance);
      const balanceAfter = direction === 'CREDIT' ? balanceBefore + amount : balanceBefore - amount;
      wallet.balance = balanceAfter;
      wallet.updatedAt = new Date();
      inMemoryDb.wallets.set(walletId, wallet);
      inMemoryDb.scheduleSave();
      return { wallet, balanceBefore, balanceAfter };
    }
  },

  walletTransactions: {
    create: async (data: Omit<WalletTransactionEntity, 'id' | 'createdAt'>) => {
      const tx: WalletTransactionEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date()
      };
      inMemoryDb.walletTransactions.set(tx.id, tx);
      return tx;
    },
    findByWalletId: async (walletId: string) => {
      return Array.from(inMemoryDb.walletTransactions.values())
        .filter(tx => tx.walletId === walletId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
  },

  payouts: {
    create: async (data: Omit<PayoutEntity, 'id' | 'requestedAt'>) => {
      const payout: PayoutEntity = {
        id: uuidv4(),
        ...data,
        requestedAt: new Date()
      };
      inMemoryDb.payouts.set(payout.id, payout);
      return payout;
    },
    findByDriverId: async (driverId: string) => {
      return Array.from(inMemoryDb.payouts.values()).filter(p => p.driverId === driverId);
    },
    listPending: async () => {
      return Array.from(inMemoryDb.payouts.values()).filter(p => p.status === PayoutStatus.REQUESTED);
    },
    update: async (id: string, data: Partial<PayoutEntity>) => {
      const existing = inMemoryDb.payouts.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      inMemoryDb.payouts.set(id, updated);
      return updated;
    }
  },

  adminUsers: {
    findByUserId: async (userId: string) => inMemoryDb.findAdminByUserId(userId),
    create: async (data: Omit<AdminUserEntity, 'id' | 'createdAt'>) => {
      const admin: AdminUserEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date()
      };
      inMemoryDb.adminUsers.set(admin.id, admin);
      return admin;
    }
  },

  auditLogs: {
    create: async (data: Omit<AuditLogEntity, 'id' | 'createdAt'>) => {
      const log: AuditLogEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date()
      };
      inMemoryDb.auditLogs.push(log);
      return log;
    }
  },

  zones: {
    listAll: async () => Array.from(inMemoryDb.zones.values()),
    findById: async (id: string) => inMemoryDb.zones.get(id),
    create: async (data: Omit<ZoneEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const zone: ZoneEntity = {
        id: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.zones.set(zone.id, zone);
      return zone;
    },
    update: async (id: string, data: Partial<ZoneEntity>) => {
      const existing = inMemoryDb.zones.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      inMemoryDb.zones.set(id, updated);
      return updated;
    },
    delete: async (id: string) => {
      return inMemoryDb.zones.delete(id);
    },
    checkServiceable: async (lat: number, lng: number) => {
      const activeZones = Array.from(inMemoryDb.zones.values()).filter(z => z.isActive);
      for (const z of activeZones) {
        const d = calculateHaversineKm(lat, lng, z.centerLatitude, z.centerLongitude);
        if (d <= z.radiusKm) {
          return { isServiceable: true, zone: z, distanceKm: Math.round(d * 10) / 10 };
        }
      }
      return { isServiceable: false, zone: null, distanceKm: null };
    }
  },

  vehicleModels: {
    listAll: async () => Array.from(inMemoryDb.vehicleModels.values()),
    findById: async (id: string) => inMemoryDb.vehicleModels.get(id),
    create: async (data: Omit<VehicleModelEntity, 'id' | 'createdAt' | 'updatedAt'>) => {
      const vm: VehicleModelEntity = {
        id: `vm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.vehicleModels.set(vm.id, vm);
      return vm;
    },
    update: async (id: string, data: Partial<VehicleModelEntity>) => {
      const existing = inMemoryDb.vehicleModels.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      inMemoryDb.vehicleModels.set(id, updated);
      return updated;
    },
    delete: async (id: string) => {
      return inMemoryDb.vehicleModels.delete(id);
    }
  }
};
