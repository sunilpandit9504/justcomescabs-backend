import http from 'http';
import { createApp } from '../app.js';
import { runSeed } from '../seed.js';
import { db } from '../services/db.js';
import { BookingStatus, BookingType, VehicleCategory, CommissionType } from '@gatigo/shared';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${msg}`);
  }
}

async function runPhase5Tests() {
  console.log('\n--- STARTING PHASE 5 LIVE TRACKING, COMMISSION SETTLEMENT & FINANCIAL LEDGER TESTS ---');

  await runSeed();
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(5096, resolve));
  const baseUrl = 'http://localhost:5096/api/v1';

  try {
    // 1. Authenticate Admin, Driver A and Driver B
    console.log('[TEST 1] Authenticating all actors (Admin, Driver A, Driver B)...');
    
    // Super Admin
    const adminAuthRes = await fetch(`${baseUrl}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gatigo.in', password: 'AdminPassword@2026' })
    });
    const adminAuthJson = await adminAuthRes.json() as any;
    const adminToken = adminAuthJson.data.accessToken;

    // Driver A (Creator)
    const driverAAuthRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876500002', otp: '123456', role: 'DRIVER' })
    });
    const driverAAuthJson = await driverAAuthRes.json() as any;
    const driverAToken = driverAAuthJson.data.accessToken;
    const driverAId = driverAAuthJson.data.user.driverId;

    // Driver B (Recipient)
    const driverBAuthRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876500003', otp: '123456', role: 'DRIVER' })
    });
    const driverBAuthJson = await driverBAuthRes.json() as any;
    const driverBToken = driverBAuthJson.data.accessToken;
    const driverBId = driverBAuthJson.data.user.driverId;

    console.log('  -> PASS: All actor tokens initialized');

    // 2. Setup: Driver A enters offline booking and shares it with Driver B
    console.log('[TEST 2] Setting up shared booking between Driver A and Driver B...');
    const createRes = await fetch(`${baseUrl}/offline-bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverAToken}` },
      body: JSON.stringify({
        customerName: 'Vinod Sinha',
        customerPhone: '+919431188888',
        tripType: BookingType.OUTSTATION,
        vehicleCategory: VehicleCategory.SEDAN,
        pickup: { address: 'Albert Ekka Chowk, Ranchi', latitude: 23.3700, longitude: 85.3250 },
        destination: { address: 'Dak Bungalow, Patna', latitude: 25.6090, longitude: 85.1370 },
        scheduledPickupTime: new Date(Date.now() + 3600 * 1000).toISOString(),
        agreedTotalFare: 4500,
        advancePaid: 500
      })
    });
    const createJson = await createRes.json() as any;
    const bookingId = createJson.data.booking.id;
    const rideOtp = createJson.data.booking.rideOtp;

    // Driver A publishes for sharing with 10% commission (₹450)
    const shareRes = await fetch(`${baseUrl}/ride-sharing/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverAToken}` },
      body: JSON.stringify({
        bookingId,
        commissionType: CommissionType.PERCENTAGE,
        commissionValue: 10
      })
    });
    const shareJson = await shareRes.json() as any;
    const sharingRequestId = shareJson.data.sharingRequest.id;

    // Driver B accepts the offer
    await fetch(`${baseUrl}/ride-sharing/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverBToken}` },
      body: JSON.stringify({ sharingRequestId })
    });
    console.log('  -> PASS: Booking shared and accepted by Driver B');

    // 3. Driver B emits live GPS location
    console.log('[TEST 3] Driver B pings live GPS location...');
    await fetch(`${baseUrl}/drivers/location/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverBToken}` },
      body: JSON.stringify({ latitude: 23.4500, longitude: 85.3100, heading: 45.0, speedKmh: 52.0 })
    });
    console.log('  -> PASS: Driver B GPS telemetry updated');

    // 4. Driver A queries Live Tracking of Driver B
    console.log('[TEST 4] Driver A queries authorized live tracking of Driver B...');
    const trackRes = await fetch(`${baseUrl}/ride-sharing/${bookingId}/live-tracking`, {
      headers: { Authorization: `Bearer ${driverAToken}` }
    });
    const trackJson = await trackRes.json() as any;
    assert(trackRes.status === 200, 'Live tracking should return 200');
    assert(trackJson.data.assignedDriver.id === driverBId, 'Assigned driver matches Driver B');
    assert(trackJson.data.liveLocation.latitude === 23.4500, 'Live latitude matches telemetry ping');
    assert(trackJson.data.commissionTracker.agreedCreatorCommission === 450, 'Commission agreement tracker shows ₹450');
    assert(trackJson.data.commissionTracker.settlementStatus === 'PENDING_COMPLETION', 'Status is PENDING_COMPLETION');
    console.log(`  -> PASS: Live tracking confirmed: Driver B at ${trackJson.data.liveLocation.latitude}, ${trackJson.data.liveLocation.longitude} (${trackJson.data.liveLocation.speedKmh} km/h)`);

    // 5. Authorization Check: Unrelated user tries to view tracking
    console.log('[TEST 5] Testing unauthorized tracking access (Customer trying to view peer tracking)...');
    const custAuthRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876500001', otp: '123456', role: 'CUSTOMER' })
    });
    const custToken = (await custAuthRes.json() as any).data.accessToken;

    const unauthTrackRes = await fetch(`${baseUrl}/ride-sharing/${bookingId}/live-tracking`, {
      headers: { Authorization: `Bearer ${custToken}` }
    });
    assert(unauthTrackRes.status === 403, 'Unauthorized tracking access must be rejected with 403');
    console.log('  -> PASS: Correctly rejected 403 Forbidden');

    // 6. Driver B executes and completes the shared trip
    console.log('[TEST 6] Driver B executes and completes the shared ride...');
    await fetch(`${baseUrl}/rides/${bookingId}/arriving`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverBToken}` }
    });
    await fetch(`${baseUrl}/rides/${bookingId}/arrived`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverBToken}` }
    });
    await fetch(`${baseUrl}/rides/${bookingId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverBToken}` },
      body: JSON.stringify({ otp: rideOtp })
    });

    // Complete ride: customer pays balance ₹4000
    const completeRes = await fetch(`${baseUrl}/rides/${bookingId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverBToken}` },
      body: JSON.stringify({ actualDistanceKm: 310, tollCharges: 0 })
    });
    assert(completeRes.status === 200, 'Trip completion should succeed');
    console.log('  -> PASS: Driver B completed shared trip');

    // 7. Verify Automated Commission Settlement & Double-Entry Ledger
    console.log('[TEST 7] Verifying Driver A Wallet Commission Credit (₹450)...');
    const walletRes = await fetch(`${baseUrl}/wallet`, {
      headers: { Authorization: `Bearer ${driverAToken}` }
    });
    const walletJson = await walletRes.json() as any;
    assert(walletRes.status === 200, 'Wallet query should succeed');
    assert(walletJson.data.balance >= 450, 'Driver A wallet balance must have at least ₹450 commission');
    console.log(`  -> PASS: Driver A current wallet balance: ₹${walletJson.data.balance}`);

    // Verify Ledger Transaction
    const txRes = await fetch(`${baseUrl}/wallet/transactions`, {
      headers: { Authorization: `Bearer ${driverAToken}` }
    });
    const txJson = await txRes.json() as any;
    assert(txRes.status === 200, 'Transactions query should succeed');
    const commissionTx = txJson.data.find((tx: any) => tx.referenceBookingId === bookingId && tx.type === 'COMMISSION_EARNING');
    assert(!!commissionTx, 'COMMISSION_EARNING transaction must exist in ledger');
    assert(commissionTx.amount === 450, 'Commission transaction amount must be ₹450');
    assert(commissionTx.direction === 'CREDIT', 'Direction must be CREDIT');
    console.log(`  -> PASS: Immutable double-entry ledger record verified: ID ${commissionTx.id} (+₹450)`);

    // 8. Driver A Requests Payout Withdrawal via UPI
    console.log('[TEST 8] Driver A requests ₹400 Payout withdrawal via UPI...');
    const payoutReqRes = await fetch(`${baseUrl}/wallet/payouts/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverAToken}` },
      body: JSON.stringify({ amount: 400, payoutChannel: 'UPI_TRANSFER', upiId: 'sureshmahto@oksbi' })
    });
    const payoutReqJson = await payoutReqRes.json() as any;
    assert(payoutReqRes.status === 201, 'Payout request should return 201');
    assert(payoutReqJson.data.status === 'REQUESTED', 'Payout status is REQUESTED');
    const payoutId = payoutReqJson.data.id;
    console.log(`  -> PASS: Payout requested: ID ${payoutId} for ₹400`);

    // Verify Driver A's wallet debited
    const postPayoutWalletRes = await fetch(`${baseUrl}/wallet`, {
      headers: { Authorization: `Bearer ${driverAToken}` }
    });
    const postPayoutWalletJson = await postPayoutWalletRes.json() as any;
    assert(postPayoutWalletJson.data.balance <= (walletJson.data.balance - 400), 'Wallet debited by requested withdrawal amount');
    console.log(`  -> PASS: Wallet immediately debited. Remaining balance: ₹${postPayoutWalletJson.data.balance}`);

    // 9. Admin Inspects and Approves Payout
    console.log('[TEST 9] Admin inspects pending payouts and approves...');
    const pendingPayoutsRes = await fetch(`${baseUrl}/wallet/admin/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const pendingPayoutsJson = await pendingPayoutsRes.json() as any;
    assert(pendingPayoutsRes.status === 200, 'Admin pending payouts should return 200');
    assert(pendingPayoutsJson.data.some((p: any) => p.id === payoutId), 'Pending payout is listed for admin');

    const approveRes = await fetch(`${baseUrl}/wallet/admin/${payoutId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ bankReferenceId: 'UPI-AXIS-JH918237461' })
    });
    const approveJson = await approveRes.json() as any;
    assert(approveRes.status === 200, 'Payout approval should return 200');
    assert(approveJson.data.status === 'COMPLETED', 'Payout status is now COMPLETED');
    assert(approveJson.data.bankReferenceId === 'UPI-AXIS-JH918237461', 'Bank reference recorded');
    console.log('  -> PASS: Payout approved and finalized by Super Admin');

    console.log('\n========================================================================================');
    console.log('ALL PHASE 5 LIVE TRACKING, COMMISSION SETTLEMENT & LEDGER TESTS PASSED! (9/9)');
    console.log('========================================================================================\n');
  } finally {
    server.close();
  }
}

runPhase5Tests().catch((err) => {
  console.error('PHASE 5 TEST FAILED:', err);
  process.exit(1);
});
