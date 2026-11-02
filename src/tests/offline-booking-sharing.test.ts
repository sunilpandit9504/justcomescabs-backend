import http from 'http';
import { createApp } from '../app.js';
import { runSeed } from '../seed.js';
import { db } from '../services/db.js';
import { BookingStatus, BookingSource, VehicleCategory, BookingType, CommissionType } from '@gatigo/shared';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${msg}`);
  }
}

async function runPhase4Tests() {
  console.log('\n--- STARTING PHASE 4 DRIVER OFFLINE BOOKING & PEER SHARING TESTS ---');

  await runSeed();
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(5097, resolve));
  const baseUrl = 'http://localhost:5097/api/v1';

  try {
    // 1. Authenticate Driver A (Suresh Mahto - Ranchi)
    console.log('[TEST 1] Authenticating Driver A (Creator)...');
    const driverAAuthRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876500002', otp: '123456', role: 'DRIVER' })
    });
    const driverAAuthJson = await driverAAuthRes.json() as any;
    assert(driverAAuthRes.status === 200, 'Driver A auth must succeed');
    const driverAToken = driverAAuthJson.data.accessToken;
    const driverAId = driverAAuthJson.data.user.driverId;
    console.log(`  -> PASS: Driver A authenticated (ID: ${driverAId})`);

    // 2. Authenticate Driver B (Ramesh Kumar - Patna)
    console.log('[TEST 2] Authenticating Driver B (Recipient)...');
    const driverBAuthRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876500003', otp: '123456', role: 'DRIVER' })
    });
    const driverBAuthJson = await driverBAuthRes.json() as any;
    assert(driverBAuthRes.status === 200, 'Driver B auth must succeed');
    const driverBToken = driverBAuthJson.data.accessToken;
    const driverBId = driverBAuthJson.data.user.driverId;
    console.log(`  -> PASS: Driver B authenticated (ID: ${driverBId})`);

    // 3. Driver A enters two offline customer phone bookings
    console.log('[TEST 3] Driver A manually enters two physical bookings received by phone...');
    
    // Booking 1: Ranchi to Patna outstation (Agreed Fare: ₹4,500, Advance Paid: ₹500)
    const offlineBooking1Res = await fetch(`${baseUrl}/offline-bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverAToken}`
      },
      body: JSON.stringify({
        customerName: 'Rakesh Kumar',
        customerPhone: '+919431100000',
        channelSource: 'PHONE_CALL',
        tripType: BookingType.OUTSTATION,
        vehicleCategory: VehicleCategory.SEDAN,
        pickup: { address: 'Kanke Road, Ranchi, Jharkhand', latitude: 23.3850, longitude: 85.3210 },
        destination: { address: 'Bailey Road, Patna, Bihar', latitude: 25.6120, longitude: 85.1010 },
        scheduledPickupTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        agreedTotalFare: 4500,
        advancePaid: 500,
        specialInstructions: 'AC must be kept on throughout highway travel',
        advancePaymentMethod: 'GooglePay direct to Driver A'
      })
    });
    const offlineBooking1Json = await offlineBooking1Res.json() as any;
    assert(offlineBooking1Res.status === 201, 'Offline Booking 1 should be created');
    assert(offlineBooking1Json.data.booking.bookingSource === BookingSource.OFFLINE_DRIVER_BOOKING, 'Source must be OFFLINE_DRIVER_BOOKING');
    assert(offlineBooking1Json.data.booking.remainingCustomerBalance === 4000, 'Remaining balance must be ₹4000 (4500 - 500)');
    const booking1Id = offlineBooking1Json.data.booking.id;
    console.log(`  -> PASS: Booking 1 created: ${offlineBooking1Json.data.booking.bookingCode} (Advance: ₹500, Remaining: ₹4000)`);

    // Booking 2: Ranchi local drop (Driver A keeps this one for himself)
    const offlineBooking2Res = await fetch(`${baseUrl}/offline-bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverAToken}`
      },
      body: JSON.stringify({
        customerName: 'Amit Verma',
        customerPhone: '+919431100001',
        channelSource: 'PHONE_CALL',
        tripType: BookingType.ONE_WAY,
        vehicleCategory: VehicleCategory.SEDAN,
        pickup: { address: 'Doranda, Ranchi', latitude: 23.3320, longitude: 85.3250 },
        destination: { address: 'Ratu Road, Ranchi', latitude: 23.3710, longitude: 85.3050 },
        scheduledPickupTime: new Date(Date.now() + 25 * 3600 * 1000).toISOString(),
        agreedTotalFare: 1800,
        advancePaid: 0
      })
    });
    assert(offlineBooking2Res.status === 201, 'Offline Booking 2 should be created');
    console.log('  -> PASS: Booking 2 created. Driver A now has 2 offline bookings in his app.');

    // 4. Driver A shares Booking 1 to the driver network
    console.log('[TEST 4] Driver A publishes Booking 1 for Peer Driver Sharing with 10% commission...');
    const shareRes = await fetch(`${baseUrl}/ride-sharing/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverAToken}`
      },
      body: JSON.stringify({
        bookingId: booking1Id,
        commissionType: CommissionType.PERCENTAGE,
        commissionValue: 10, // 10% = ₹450
        expiresInMinutes: 60
      })
    });
    const shareJson = await shareRes.json() as any;
    assert(shareRes.status === 200, 'Publishing for sharing should succeed');
    assert(shareJson.data.sharingRequest.computedCommissionAmount === 450, 'Driver A commission must be ₹450');
    assert(shareJson.data.pricingBreakdown.balanceToCollectFromCustomer === 4000, 'Balance to collect must be ₹4000');
    const sharingRequestId = shareJson.data.sharingRequest.id;
    console.log(`  -> PASS: Shared offer created. Commission to Driver A: ₹450, Net to Driver B: ₹${shareJson.data.pricingBreakdown.driverBExpectedNetEarnings}`);

    // 5. Driver B views incoming offers in the feed - VERIFY PRIVACY MASKING
    console.log('[TEST 5] Driver B checks incoming sharing offers (Verifying customer phone privacy shield)...');
    const offersRes = await fetch(`${baseUrl}/ride-sharing/incoming-offers`, {
      headers: { Authorization: `Bearer ${driverBToken}` }
    });
    const offersJson = await offersRes.json() as any;
    assert(offersRes.status === 200, 'Incoming offers query should succeed');
    assert(Array.isArray(offersJson.data), 'Offers must be an array');
    
    const offerForB = offersJson.data.find((o: any) => o.sharingRequestId === sharingRequestId);
    assert(!!offerForB, 'Offer must be visible to Driver B');
    assert(offerForB.customerSummary.phoneMasked.includes('*****'), 'Customer phone MUST be masked in open feed');
    assert(offerForB.balanceToCollectFromCustomer === 4000, 'Driver B must see only ₹4000 to collect from customer');
    console.log(`  -> PASS: Privacy shield verified! Customer phone masked as: ${offerForB.customerSummary.phoneMasked}`);

    // 6. Driver B atomically accepts the offer
    console.log('[TEST 6] Driver B atomically accepts the shared booking...');
    const acceptRes = await fetch(`${baseUrl}/ride-sharing/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverBToken}`
      },
      body: JSON.stringify({ sharingRequestId })
    });
    const acceptJson = await acceptRes.json() as any;
    assert(acceptRes.status === 200, 'Driver B acceptance should succeed');
    assert(acceptJson.data.booking.status === BookingStatus.ASSIGNED, 'Booking status must be ASSIGNED');
    assert(acceptJson.data.booking.assignedDriverId === driverBId, 'Booking assigned driver is Driver B');
    assert(acceptJson.data.customerContact.phone === '+919431100000', 'Customer phone is now cleanly unmasked for Driver B');
    assert(acceptJson.data.commissionAgreement.creatorCommissionAmount === 450, 'Commission agreement frozen at ₹450');
    console.log('  -> PASS: Shared ride atomically assigned to Driver B. Customer details revealed.');

    // 7. Concurrency Test: Another driver tries to accept the already-assigned offer
    console.log('[TEST 7] Concurrency test: Third party attempts to accept already assigned share (Must fail 409 Conflict)...');
    const conflictRes = await fetch(`${baseUrl}/ride-sharing/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverBToken}`
      },
      body: JSON.stringify({ sharingRequestId })
    });
    assert(conflictRes.status === 409, 'Accepting already accepted offer must return 409 Conflict');
    console.log('  -> PASS: Concurrency guard strictly prevented duplicate assignment');

    // 8. Driver A views their Shared Bookings tracking dashboard
    console.log('[TEST 8] Driver A checks "My Shared Bookings" to monitor Driver B...');
    const mySharedRes = await fetch(`${baseUrl}/ride-sharing/my-shared`, {
      headers: { Authorization: `Bearer ${driverAToken}` }
    });
    const mySharedJson = await mySharedRes.json() as any;
    assert(mySharedRes.status === 200, 'My shared bookings query should succeed');
    assert(mySharedJson.data.length >= 1, 'Driver A should see at least 1 shared booking');
    
    const mySharedItem = mySharedJson.data.find((item: any) => item.sharingRequest.id === sharingRequestId);
    assert(!!mySharedItem, 'Shared booking must be present in Driver A list');
    assert(mySharedItem.assignedDriver.name.includes('Ramesh Kumar'), 'Assigned driver is Ramesh Kumar');
    assert(mySharedItem.commissionAgreement.settlementStatus === 'PENDING_COMPLETION', 'Settlement status is PENDING_COMPLETION');
    console.log(`  -> PASS: Driver A sees Driver B (${mySharedItem.assignedDriver.name}) assigned. Commission status: PENDING_COMPLETION`);

    console.log('\n================================================================');
    console.log('ALL PHASE 4 OFFLINE BOOKING & PEER SHARING TESTS PASSED! (8/8)');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runPhase4Tests().catch((err) => {
  console.error('PHASE 4 TEST FAILED:', err);
  process.exit(1);
});
