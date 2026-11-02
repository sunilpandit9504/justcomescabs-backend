export declare enum UserRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    OPERATIONS_ADMIN = "OPERATIONS_ADMIN",
    FINANCE_ADMIN = "FINANCE_ADMIN",
    SUPPORT_AGENT = "SUPPORT_AGENT",
    CUSTOMER = "CUSTOMER",
    DRIVER = "DRIVER",
    FLEET_MANAGER = "FLEET_MANAGER"
}
export declare enum VehicleCategory {
    BIKE = "BIKE",
    AUTO = "AUTO",
    MINI = "MINI",
    HATCHBACK = "HATCHBACK",
    SEDAN = "SEDAN",
    SUV = "SUV",
    PREMIUM = "PREMIUM",
    OUTSTATION = "OUTSTATION"
}
export declare enum BookingSource {
    CUSTOMER_APP = "CUSTOMER_APP",
    OFFLINE_DRIVER_BOOKING = "OFFLINE_DRIVER_BOOKING"
}
export declare enum BookingType {
    ONE_WAY = "ONE_WAY",
    ROUND_TRIP = "ROUND_TRIP",
    LOCAL_RENTAL = "LOCAL_RENTAL",
    OUTSTATION = "OUTSTATION",
    AIRPORT = "AIRPORT"
}
export declare enum BookingStatus {
    DRAFT = "DRAFT",
    CONFIRMED = "CONFIRMED",
    PENDING_DISPATCH = "PENDING_DISPATCH",
    AVAILABLE_FOR_SHARING = "AVAILABLE_FOR_SHARING",
    OFFERED = "OFFERED",
    ASSIGNED = "ASSIGNED",
    DRIVER_ARRIVING = "DRIVER_ARRIVING",
    ARRIVED_AT_PICKUP = "ARRIVED_AT_PICKUP",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    DISPUTED = "DISPUTED"
}
export declare enum OfflineChannelSource {
    PHONE_CALL = "PHONE_CALL",
    WHATSAPP = "WHATSAPP",
    DIRECT_CUSTOMER = "DIRECT_CUSTOMER",
    HOTEL_TIEUP = "HOTEL_TIEUP",
    TRAVEL_AGENT = "TRAVEL_AGENT",
    OTHER = "OTHER"
}
export declare enum SharingMode {
    DIRECT_OFFER = "DIRECT_OFFER",
    OPEN_DRIVER_NETWORK = "OPEN_DRIVER_NETWORK"
}
export declare enum CommissionType {
    PERCENTAGE = "PERCENTAGE",
    FIXED_AMOUNT = "FIXED_AMOUNT"
}
export declare enum PaymentMethod {
    CASH = "CASH",
    UPI = "UPI",
    RAZORPAY_ONLINE = "RAZORPAY_ONLINE",
    WALLET = "WALLET",
    SPLIT = "SPLIT"
}
export declare enum PaymentStatus {
    PENDING = "PENDING",
    PARTIALLY_PAID = "PARTIALLY_PAID",
    PAID = "PAID",
    REFUNDED = "REFUNDED",
    DISPUTED = "DISPUTED"
}
export declare enum WalletTransactionType {
    TRIP_EARNING = "TRIP_EARNING",
    COMMISSION_EARNING = "COMMISSION_EARNING",
    COMMISSION_DEDUCTION = "COMMISSION_DEDUCTION",
    PLATFORM_FEE_DEDUCTION = "PLATFORM_FEE_DEDUCTION",
    CASH_COLLECTED_SURPLUS_DEBIT = "CASH_COLLECTED_SURPLUS_DEBIT",
    TOPUP = "TOPUP",
    PAYOUT_WITHDRAWAL = "PAYOUT_WITHDRAWAL",
    REFUND = "REFUND",
    DISPUTE_ADJUSTMENT = "DISPUTE_ADJUSTMENT"
}
export declare enum PayoutStatus {
    REQUESTED = "REQUESTED",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    REJECTED = "REJECTED"
}
export declare enum KycStatus {
    PENDING = "PENDING",
    UNDER_REVIEW = "UNDER_REVIEW",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED",
    SUSPENDED = "SUSPENDED"
}
export interface Coordinates {
    latitude: number;
    longitude: number;
    address?: string;
}
export interface DriverTelemetry {
    driverId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speedKmh?: number;
    timestamp: string;
}
export declare const WS_EVENTS: {
    readonly BOOKING_CREATED: "booking.created";
    readonly BOOKING_REQUEST: "booking.request";
    readonly BOOKING_ASSIGNED: "booking.assigned";
    readonly BOOKING_REASSIGNED: "booking.reassigned";
    readonly BOOKING_CANCELLED: "booking.cancelled";
    readonly RIDE_SHARE_OFFERED: "ride_share.offered";
    readonly RIDE_SHARE_ACCEPTED: "ride_share.accepted";
    readonly RIDE_SHARE_REJECTED: "ride_share.rejected";
    readonly RIDE_SHARE_EXPIRED: "ride_share.expired";
    readonly DRIVER_LOCATION_EMIT: "driver.location.emit";
    readonly DRIVER_LOCATION_BROADCAST: "driver.location.broadcast";
    readonly RIDE_STATUS_UPDATED: "ride.status_updated";
    readonly RIDE_COMPLETED: "ride.completed";
    readonly COMMISSION_PENDING: "commission.pending";
    readonly COMMISSION_CREDITED: "commission.credited";
    readonly PAYMENT_UPDATED: "payment.updated";
    readonly PAYOUT_UPDATED: "payout.updated";
};
//# sourceMappingURL=index.d.ts.map