"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.inMemoryDb = void 0;
const uuid_1 = require("uuid");
const shared_1 = require("@gatigo/shared");
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
class InMemoryDatabase {
    users = new Map();
    customerProfiles = new Map();
    driverProfiles = new Map();
    vehicles = new Map();
    driverDocuments = new Map();
    driverAvailability = new Map();
    savedAddresses = new Map();
    bookings = new Map();
    offlineBookingDetails = new Map();
    rideSharingRequests = new Map();
    commissionAgreements = new Map();
    wallets = new Map();
    walletTransactions = new Map();
    payouts = new Map();
    adminUsers = new Map();
    notifications = new Map();
    auditLogs = [];
    zones = new Map();
    vehicleModels = new Map();
    constructor() {
        this.initDefaultZones();
        this.initDefaultVehicleModels();
    }
    initDefaultZones() {
        const defaults = [
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
    initDefaultVehicleModels() {
        const models = [
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
    findUserByPhone(phone) {
        for (const u of this.users.values()) {
            if (u.phone === phone)
                return u;
        }
        return undefined;
    }
    findUserByEmail(email) {
        for (const u of this.users.values()) {
            if (u.email?.toLowerCase() === email.toLowerCase())
                return u;
        }
        return undefined;
    }
    findCustomerByUserId(userId) {
        for (const c of this.customerProfiles.values()) {
            if (c.userId === userId)
                return c;
        }
        return undefined;
    }
    findDriverByUserId(userId) {
        for (const d of this.driverProfiles.values()) {
            if (d.userId === userId)
                return d;
        }
        return undefined;
    }
    findAdminByUserId(userId) {
        for (const a of this.adminUsers.values()) {
            if (a.userId === userId)
                return a;
        }
        return undefined;
    }
    findWalletByUserId(userId) {
        for (const w of this.wallets.values()) {
            if (w.userId === userId)
                return w;
        }
        return undefined;
    }
    getOrCreateWallet(userId) {
        let wallet = this.findWalletByUserId(userId);
        if (!wallet) {
            wallet = {
                id: (0, uuid_1.v4)(),
                userId,
                currency: 'INR',
                balance: 0.00,
                lockedBalance: 0.00,
                isFrozen: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.wallets.set(wallet.id, wallet);
        }
        return wallet;
    }
}
exports.inMemoryDb = new InMemoryDatabase();
// Clean DB Service facade
exports.db = {
    users: {
        findById: async (id) => exports.inMemoryDb.users.get(id),
        findByPhone: async (phone) => exports.inMemoryDb.findUserByPhone(phone),
        findByEmail: async (email) => exports.inMemoryDb.findUserByEmail(email),
        create: async (data) => {
            const user = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            exports.inMemoryDb.users.set(user.id, user);
            return user;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.users.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            exports.inMemoryDb.users.set(id, updated);
            return updated;
        },
        listAll: async () => Array.from(exports.inMemoryDb.users.values())
    },
    customerProfiles: {
        findById: async (id) => exports.inMemoryDb.customerProfiles.get(id),
        findByUserId: async (userId) => exports.inMemoryDb.findCustomerByUserId(userId),
        create: async (data) => {
            const profile = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            exports.inMemoryDb.customerProfiles.set(profile.id, profile);
            return profile;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.customerProfiles.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            exports.inMemoryDb.customerProfiles.set(id, updated);
            return updated;
        }
    },
    driverProfiles: {
        findById: async (id) => exports.inMemoryDb.driverProfiles.get(id),
        findByUserId: async (userId) => exports.inMemoryDb.findDriverByUserId(userId),
        create: async (data) => {
            const profile = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            exports.inMemoryDb.driverProfiles.set(profile.id, profile);
            return profile;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.driverProfiles.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            exports.inMemoryDb.driverProfiles.set(id, updated);
            return updated;
        },
        listPendingKyc: async () => {
            return Array.from(exports.inMemoryDb.driverProfiles.values()).filter(d => d.kycStatus === shared_1.KycStatus.PENDING || d.kycStatus === shared_1.KycStatus.UNDER_REVIEW);
        },
        listAll: async () => Array.from(exports.inMemoryDb.driverProfiles.values())
    },
    vehicles: {
        findById: async (id) => exports.inMemoryDb.vehicles.get(id),
        findByDriverId: async (driverId) => {
            return Array.from(exports.inMemoryDb.vehicles.values()).filter(v => v.driverId === driverId);
        },
        create: async (data) => {
            const vehicle = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            exports.inMemoryDb.vehicles.set(vehicle.id, vehicle);
            return vehicle;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.vehicles.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            exports.inMemoryDb.vehicles.set(id, updated);
            return updated;
        }
    },
    driverDocuments: {
        findByDriverId: async (driverId) => {
            return Array.from(exports.inMemoryDb.driverDocuments.values()).filter(d => d.driverId === driverId);
        },
        create: async (data) => {
            const doc = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date()
            };
            exports.inMemoryDb.driverDocuments.set(doc.id, doc);
            return doc;
        }
    },
    driverAvailability: {
        findByDriverId: async (driverId) => exports.inMemoryDb.driverAvailability.get(driverId),
        upsert: async (driverId, data) => {
            const existing = exports.inMemoryDb.driverAvailability.get(driverId);
            if (existing) {
                const updated = { ...existing, ...data, lastPingAt: new Date() };
                exports.inMemoryDb.driverAvailability.set(driverId, updated);
                return updated;
            }
            const created = {
                id: (0, uuid_1.v4)(),
                driverId,
                isOnline: data.isOnline ?? false,
                currentLatitude: data.currentLatitude ?? 0,
                currentLongitude: data.currentLongitude ?? 0,
                heading: data.heading,
                speedKmh: data.speedKmh,
                lastPingAt: new Date()
            };
            exports.inMemoryDb.driverAvailability.set(driverId, created);
            return created;
        },
        findOnlineDriversNearby: async (lat, lng, maxDistanceKm = 15) => {
            const onlineDrivers = Array.from(exports.inMemoryDb.driverAvailability.values()).filter(d => d.isOnline);
            return onlineDrivers;
        }
    },
    savedAddresses: {
        findByCustomerId: async (customerId) => {
            return Array.from(exports.inMemoryDb.savedAddresses.values()).filter(a => a.customerId === customerId);
        },
        create: async (data) => {
            const address = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date()
            };
            exports.inMemoryDb.savedAddresses.set(address.id, address);
            return address;
        },
        delete: async (id) => {
            exports.inMemoryDb.savedAddresses.delete(id);
        }
    },
    bookings: {
        findById: async (id) => exports.inMemoryDb.bookings.get(id),
        findByCode: async (code) => {
            for (const b of exports.inMemoryDb.bookings.values()) {
                if (b.bookingCode === code)
                    return b;
            }
            return undefined;
        },
        findByCustomerId: async (customerId) => {
            return Array.from(exports.inMemoryDb.bookings.values()).filter(b => b.customerId === customerId);
        },
        findByDriverId: async (driverId) => {
            return Array.from(exports.inMemoryDb.bookings.values()).filter(b => b.assignedDriverId === driverId || b.creatorDriverId === driverId);
        },
        findOfflineCreatedByDriver: async (driverId) => {
            return Array.from(exports.inMemoryDb.bookings.values()).filter(b => b.creatorDriverId === driverId && b.bookingSource === shared_1.BookingSource.OFFLINE_DRIVER_BOOKING);
        },
        create: async (data) => {
            const booking = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            exports.inMemoryDb.bookings.set(booking.id, booking);
            return booking;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.bookings.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            exports.inMemoryDb.bookings.set(id, updated);
            return updated;
        },
        listAll: async () => Array.from(exports.inMemoryDb.bookings.values())
    },
    offlineBookingDetails: {
        findByBookingId: async (bookingId) => {
            for (const d of exports.inMemoryDb.offlineBookingDetails.values()) {
                if (d.bookingId === bookingId)
                    return d;
            }
            return undefined;
        },
        create: async (data) => {
            const detail = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date()
            };
            exports.inMemoryDb.offlineBookingDetails.set(detail.id, detail);
            return detail;
        }
    },
    rideSharingRequests: {
        findById: async (id) => exports.inMemoryDb.rideSharingRequests.get(id),
        findByBookingId: async (bookingId) => {
            for (const r of exports.inMemoryDb.rideSharingRequests.values()) {
                if (r.bookingId === bookingId)
                    return r;
            }
            return undefined;
        },
        findActiveOffersForDriver: async (driverId) => {
            const now = new Date();
            return Array.from(exports.inMemoryDb.rideSharingRequests.values()).filter(r => {
                if (r.status !== 'OFFERED' || r.expiresAt <= now)
                    return false;
                // Never show to the creator driver themselves
                if (r.creatorDriverId === driverId)
                    return false;
                // If shared in DIRECT mode to a specific driver, only show to that target driver
                if (r.sharingMode === shared_1.SharingMode.DIRECT_OFFER && r.directTargetDriverId) {
                    return r.directTargetDriverId === driverId;
                }
                // Open Driver Network Pool: available to qualified peer drivers
                return true;
            });
        },
        findSharedByCreatorDriver: async (creatorDriverId) => {
            return Array.from(exports.inMemoryDb.rideSharingRequests.values()).filter(r => r.creatorDriverId === creatorDriverId);
        },
        create: async (data) => {
            const req = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            exports.inMemoryDb.rideSharingRequests.set(req.id, req);
            return req;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.rideSharingRequests.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            exports.inMemoryDb.rideSharingRequests.set(id, updated);
            return updated;
        }
    },
    commissionAgreements: {
        findByBookingId: async (bookingId) => {
            for (const ca of exports.inMemoryDb.commissionAgreements.values()) {
                if (ca.bookingId === bookingId)
                    return ca;
            }
            return undefined;
        },
        create: async (data) => {
            const ca = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date()
            };
            exports.inMemoryDb.commissionAgreements.set(ca.id, ca);
            return ca;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.commissionAgreements.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data };
            exports.inMemoryDb.commissionAgreements.set(id, updated);
            return updated;
        }
    },
    wallets: {
        findByUserId: async (userId) => exports.inMemoryDb.getOrCreateWallet(userId),
        findById: async (id) => exports.inMemoryDb.wallets.get(id),
        updateBalance: async (walletId, amount, direction) => {
            const wallet = exports.inMemoryDb.wallets.get(walletId);
            if (!wallet)
                throw new Error('Wallet not found');
            const balanceBefore = Number(wallet.balance);
            const balanceAfter = direction === 'CREDIT' ? balanceBefore + amount : balanceBefore - amount;
            wallet.balance = balanceAfter;
            wallet.updatedAt = new Date();
            exports.inMemoryDb.wallets.set(walletId, wallet);
            return { wallet, balanceBefore, balanceAfter };
        }
    },
    walletTransactions: {
        create: async (data) => {
            const tx = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date()
            };
            exports.inMemoryDb.walletTransactions.set(tx.id, tx);
            return tx;
        },
        findByWalletId: async (walletId) => {
            return Array.from(exports.inMemoryDb.walletTransactions.values())
                .filter(tx => tx.walletId === walletId)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
    },
    payouts: {
        create: async (data) => {
            const payout = {
                id: (0, uuid_1.v4)(),
                ...data,
                requestedAt: new Date()
            };
            exports.inMemoryDb.payouts.set(payout.id, payout);
            return payout;
        },
        findByDriverId: async (driverId) => {
            return Array.from(exports.inMemoryDb.payouts.values()).filter(p => p.driverId === driverId);
        },
        listPending: async () => {
            return Array.from(exports.inMemoryDb.payouts.values()).filter(p => p.status === shared_1.PayoutStatus.REQUESTED);
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.payouts.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data };
            exports.inMemoryDb.payouts.set(id, updated);
            return updated;
        }
    },
    adminUsers: {
        findByUserId: async (userId) => exports.inMemoryDb.findAdminByUserId(userId),
        create: async (data) => {
            const admin = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date()
            };
            exports.inMemoryDb.adminUsers.set(admin.id, admin);
            return admin;
        }
    },
    auditLogs: {
        create: async (data) => {
            const log = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date()
            };
            exports.inMemoryDb.auditLogs.push(log);
            return log;
        }
    },
    zones: {
        listAll: async () => Array.from(exports.inMemoryDb.zones.values()),
        findById: async (id) => exports.inMemoryDb.zones.get(id),
        create: async (data) => {
            const zone = {
                id: (0, uuid_1.v4)(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            exports.inMemoryDb.zones.set(zone.id, zone);
            return zone;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.zones.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            exports.inMemoryDb.zones.set(id, updated);
            return updated;
        },
        delete: async (id) => {
            return exports.inMemoryDb.zones.delete(id);
        },
        checkServiceable: async (lat, lng) => {
            const activeZones = Array.from(exports.inMemoryDb.zones.values()).filter(z => z.isActive);
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
        listAll: async () => Array.from(exports.inMemoryDb.vehicleModels.values()),
        findById: async (id) => exports.inMemoryDb.vehicleModels.get(id),
        create: async (data) => {
            const vm = {
                id: `vm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            exports.inMemoryDb.vehicleModels.set(vm.id, vm);
            return vm;
        },
        update: async (id, data) => {
            const existing = exports.inMemoryDb.vehicleModels.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...data, updatedAt: new Date() };
            exports.inMemoryDb.vehicleModels.set(id, updated);
            return updated;
        },
        delete: async (id) => {
            return exports.inMemoryDb.vehicleModels.delete(id);
        }
    }
};
