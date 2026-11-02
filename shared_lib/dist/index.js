"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WS_EVENTS = exports.KycStatus = exports.PayoutStatus = exports.WalletTransactionType = exports.PaymentStatus = exports.PaymentMethod = exports.CommissionType = exports.SharingMode = exports.OfflineChannelSource = exports.BookingStatus = exports.BookingType = exports.BookingSource = exports.VehicleCategory = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["OPERATIONS_ADMIN"] = "OPERATIONS_ADMIN";
    UserRole["FINANCE_ADMIN"] = "FINANCE_ADMIN";
    UserRole["SUPPORT_AGENT"] = "SUPPORT_AGENT";
    UserRole["CUSTOMER"] = "CUSTOMER";
    UserRole["DRIVER"] = "DRIVER";
    UserRole["FLEET_MANAGER"] = "FLEET_MANAGER";
})(UserRole || (exports.UserRole = UserRole = {}));
var VehicleCategory;
(function (VehicleCategory) {
    VehicleCategory["BIKE"] = "BIKE";
    VehicleCategory["AUTO"] = "AUTO";
    VehicleCategory["MINI"] = "MINI";
    VehicleCategory["HATCHBACK"] = "HATCHBACK";
    VehicleCategory["SEDAN"] = "SEDAN";
    VehicleCategory["SUV"] = "SUV";
    VehicleCategory["PREMIUM"] = "PREMIUM";
    VehicleCategory["OUTSTATION"] = "OUTSTATION";
})(VehicleCategory || (exports.VehicleCategory = VehicleCategory = {}));
var BookingSource;
(function (BookingSource) {
    BookingSource["CUSTOMER_APP"] = "CUSTOMER_APP";
    BookingSource["OFFLINE_DRIVER_BOOKING"] = "OFFLINE_DRIVER_BOOKING";
})(BookingSource || (exports.BookingSource = BookingSource = {}));
var BookingType;
(function (BookingType) {
    BookingType["ONE_WAY"] = "ONE_WAY";
    BookingType["ROUND_TRIP"] = "ROUND_TRIP";
    BookingType["LOCAL_RENTAL"] = "LOCAL_RENTAL";
    BookingType["OUTSTATION"] = "OUTSTATION";
    BookingType["AIRPORT"] = "AIRPORT";
})(BookingType || (exports.BookingType = BookingType = {}));
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["DRAFT"] = "DRAFT";
    BookingStatus["CONFIRMED"] = "CONFIRMED";
    BookingStatus["PENDING_DISPATCH"] = "PENDING_DISPATCH";
    BookingStatus["AVAILABLE_FOR_SHARING"] = "AVAILABLE_FOR_SHARING";
    BookingStatus["OFFERED"] = "OFFERED";
    BookingStatus["ASSIGNED"] = "ASSIGNED";
    BookingStatus["DRIVER_ARRIVING"] = "DRIVER_ARRIVING";
    BookingStatus["ARRIVED_AT_PICKUP"] = "ARRIVED_AT_PICKUP";
    BookingStatus["IN_PROGRESS"] = "IN_PROGRESS";
    BookingStatus["COMPLETED"] = "COMPLETED";
    BookingStatus["CANCELLED"] = "CANCELLED";
    BookingStatus["DISPUTED"] = "DISPUTED";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
var OfflineChannelSource;
(function (OfflineChannelSource) {
    OfflineChannelSource["PHONE_CALL"] = "PHONE_CALL";
    OfflineChannelSource["WHATSAPP"] = "WHATSAPP";
    OfflineChannelSource["DIRECT_CUSTOMER"] = "DIRECT_CUSTOMER";
    OfflineChannelSource["HOTEL_TIEUP"] = "HOTEL_TIEUP";
    OfflineChannelSource["TRAVEL_AGENT"] = "TRAVEL_AGENT";
    OfflineChannelSource["OTHER"] = "OTHER";
})(OfflineChannelSource || (exports.OfflineChannelSource = OfflineChannelSource = {}));
var SharingMode;
(function (SharingMode) {
    SharingMode["DIRECT_OFFER"] = "DIRECT_OFFER";
    SharingMode["OPEN_DRIVER_NETWORK"] = "OPEN_DRIVER_NETWORK";
})(SharingMode || (exports.SharingMode = SharingMode = {}));
var CommissionType;
(function (CommissionType) {
    CommissionType["PERCENTAGE"] = "PERCENTAGE";
    CommissionType["FIXED_AMOUNT"] = "FIXED_AMOUNT";
})(CommissionType || (exports.CommissionType = CommissionType = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["UPI"] = "UPI";
    PaymentMethod["RAZORPAY_ONLINE"] = "RAZORPAY_ONLINE";
    PaymentMethod["WALLET"] = "WALLET";
    PaymentMethod["SPLIT"] = "SPLIT";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["PARTIALLY_PAID"] = "PARTIALLY_PAID";
    PaymentStatus["PAID"] = "PAID";
    PaymentStatus["REFUNDED"] = "REFUNDED";
    PaymentStatus["DISPUTED"] = "DISPUTED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var WalletTransactionType;
(function (WalletTransactionType) {
    WalletTransactionType["TRIP_EARNING"] = "TRIP_EARNING";
    WalletTransactionType["COMMISSION_EARNING"] = "COMMISSION_EARNING";
    WalletTransactionType["COMMISSION_DEDUCTION"] = "COMMISSION_DEDUCTION";
    WalletTransactionType["PLATFORM_FEE_DEDUCTION"] = "PLATFORM_FEE_DEDUCTION";
    WalletTransactionType["CASH_COLLECTED_SURPLUS_DEBIT"] = "CASH_COLLECTED_SURPLUS_DEBIT";
    WalletTransactionType["TOPUP"] = "TOPUP";
    WalletTransactionType["PAYOUT_WITHDRAWAL"] = "PAYOUT_WITHDRAWAL";
    WalletTransactionType["REFUND"] = "REFUND";
    WalletTransactionType["DISPUTE_ADJUSTMENT"] = "DISPUTE_ADJUSTMENT";
})(WalletTransactionType || (exports.WalletTransactionType = WalletTransactionType = {}));
var PayoutStatus;
(function (PayoutStatus) {
    PayoutStatus["REQUESTED"] = "REQUESTED";
    PayoutStatus["PROCESSING"] = "PROCESSING";
    PayoutStatus["COMPLETED"] = "COMPLETED";
    PayoutStatus["FAILED"] = "FAILED";
    PayoutStatus["REJECTED"] = "REJECTED";
})(PayoutStatus || (exports.PayoutStatus = PayoutStatus = {}));
var KycStatus;
(function (KycStatus) {
    KycStatus["PENDING"] = "PENDING";
    KycStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    KycStatus["VERIFIED"] = "VERIFIED";
    KycStatus["REJECTED"] = "REJECTED";
    KycStatus["SUSPENDED"] = "SUSPENDED";
})(KycStatus || (exports.KycStatus = KycStatus = {}));
exports.WS_EVENTS = {
    // Dispatch & Booking
    BOOKING_CREATED: 'booking.created',
    BOOKING_REQUEST: 'booking.request',
    BOOKING_ASSIGNED: 'booking.assigned',
    BOOKING_REASSIGNED: 'booking.reassigned',
    BOOKING_CANCELLED: 'booking.cancelled',
    // Offline Sharing Specific
    RIDE_SHARE_OFFERED: 'ride_share.offered',
    RIDE_SHARE_ACCEPTED: 'ride_share.accepted',
    RIDE_SHARE_REJECTED: 'ride_share.rejected',
    RIDE_SHARE_EXPIRED: 'ride_share.expired',
    // Real-Time GPS Tracking
    DRIVER_LOCATION_EMIT: 'driver.location.emit',
    DRIVER_LOCATION_BROADCAST: 'driver.location.broadcast',
    // Ride Lifecycle
    RIDE_STATUS_UPDATED: 'ride.status_updated',
    RIDE_COMPLETED: 'ride.completed',
    // Financial
    COMMISSION_PENDING: 'commission.pending',
    COMMISSION_CREDITED: 'commission.credited',
    PAYMENT_UPDATED: 'payment.updated',
    PAYOUT_UPDATED: 'payout.updated'
};
