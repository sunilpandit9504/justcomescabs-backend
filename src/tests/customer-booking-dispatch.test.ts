import http from 'http';
import { createApp } from '../app.js';
import { runSeed } from '../seed.js';
import { db } from '../services/db.js';
import { BookingStatus, VehicleCategory } from '@gatigo/shared';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${msg}`);
  }
}

async function runPhase3Tests() {
  console.log('\n--- STARTING PHASE 3 CUSTOMER BOOKING & DISPATCH WORKFLOW TESTS ---');

  await runSeed();
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(5098, resolve));
  const baseUrl = 'http://localhost:5098/api/v1';

  try {
    // 1. Authenticate Customer (Aarav Sharma)
    console.log('[TEST 1] Authenticating Customer (Aarav Sharma)...');
    const custAuthRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876500001', otp: '123456', role: 'CUSTOMER' })
    });
    const custAuthJson = await custAuthRes.json() as any;
    assert(custAuthRes.status === 200, 'Customer auth should succeed');
    const customerToken = custAuthJson.data.accessToken;
    console.log('  -> PASS: Customer authenticated');

    // 2. Authenticate Driver A (Suresh Mahto)
    console.log('[TEST 2] Authenticating Driver A (Suresh Mahto)...');
    const driverAAuthRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876500002', otp: '123456', role: 'DRIVER' })
    });
    const driverAAuthJson = await driverAAuthRes.json() as any;
    assert(driverAAuthRes.status === 200, 'Driver A auth should succeed');
    const driverAToken = driverAAuthJson.data.accessToken;
    const driverAId = driverAAuthJson.data.user.driverId;
    console.log('  -> PASS: Driver A authenticated (ID: ' + driverAId + ')');

    // 3. Authenticate Driver B (Ramesh Kumar)
    console.log('[TEST 3] Authenticating Driver B (Ramesh Kumar)...');
    const driverBAuthRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876500003', otp: '123456', role: 'DRIVER' })
    });
    const driverBAuthJson = await driverBAuthRes.json() as any;
    assert(driverBAuthRes.status === 200, 'Driver B auth should succeed');
    const driverBToken = driverBAuthJson.data.accessToken;
    console.log('  -> PASS: Driver B authenticated');

    // 4. Test Fare Estimation (Ranchi Station -> Birsa Munda Airport)
    console.log('[TEST 4] Testing Fare Estimation across categories...');
    const estimateRes = await fetch(`${baseUrl}/pricing/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup: { latitude: 23.3441, longitude: 85.3096, address: 'Ranchi Railway Station' },
        destination: { latitude: 23.3150, longitude: 85.3218, address: 'Birsa Munda Airport' }
      })
    });
    const estimateJson = await estimateRes.json() as any;
    assert(estimateRes.status === 200, 'Estimate endpoint should return 200');
    assert(Array.isArray(estimateJson.data), 'Estimates should be an array');
    assert(estimateJson.data.length >= 4, 'Should return multiple vehicle categories');
    
    const sedanEstimate = estimateJson.data.find((e: any) => e.category === VehicleCategory.SEDAN);
    assert(!!sedanEstimate, 'Sedan category estimate must be present');
    console.log(`  -> PASS: Distance ${sedanEstimate.distanceKm} km, Duration ${sedanEstimate.durationMinutes} min, Sedan Fare: ₹${sedanEstimate.estimatedFare}`);

    // 5. Customer creates Booking
    console.log('[TEST 5] Customer creates Booking for SEDAN...');
    const createBookingRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        pickup: { latitude: 23.3441, longitude: 85.3096, address: 'Ranchi Railway Station' },
        destination: { latitude: 23.3150, longitude: 85.3218, address: 'Birsa Munda Airport' },
        vehicleCategory: VehicleCategory.SEDAN
      })
    });
    const createBookingJson = await createBookingRes.json() as any;
    assert(createBookingRes.status === 201, 'Booking creation should return 201');
    assert(createBookingJson.data.status === BookingStatus.PENDING_DISPATCH, 'Booking status must be PENDING_DISPATCH');
    assert(!!createBookingJson.data.rideOtp, '4-digit ride OTP must be generated');
    const bookingId = createBookingJson.data.id;
    const rideOtp = createBookingJson.data.rideOtp;
    console.log(`  -> PASS: Booking created: ${createBookingJson.data.bookingCode} (OTP: ${rideOtp})`);

    // 6. Driver A atomically accepts booking
    console.log('[TEST 6] Driver A accepts booking...');
    const acceptRes = await fetch(`${baseUrl}/dispatch/bookings/${bookingId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverAToken}` }
    });
    const acceptJson = await acceptRes.json() as any;
    assert(acceptRes.status === 200, 'Driver A accept should succeed');
    assert(acceptJson.data.status === BookingStatus.ASSIGNED, 'Booking status should now be ASSIGNED');
    assert(acceptJson.data.assignedDriverId === driverAId, 'Assigned driver matches Driver A');
    console.log('  -> PASS: Ride atomically assigned to Driver A');

    // 7. Concurrency Test: Driver B tries to accept already assigned ride
    console.log('[TEST 7] Driver B attempts to accept same booking (Must be rejected with 409 Conflict)...');
    const conflictRes = await fetch(`${baseUrl}/dispatch/bookings/${bookingId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverBToken}` }
    });
    assert(conflictRes.status === 409, 'Concurrent acceptance must return 409 Conflict');
    console.log('  -> PASS: Concurrency guard strictly prevented double-acceptance');

    // 8. Driver A marks arriving and arrived
    console.log('[TEST 8] Driver A marks Arriving and Arrived at pickup...');
    const arrivingRes = await fetch(`${baseUrl}/rides/${bookingId}/arriving`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverAToken}` }
    });
    assert(arrivingRes.status === 200, 'Arriving status update should succeed');

    const arrivedRes = await fetch(`${baseUrl}/rides/${bookingId}/arrived`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverAToken}` }
    });
    assert(arrivedRes.status === 200, 'Arrived status update should succeed');
    console.log('  -> PASS: Driver marked arriving and arrived at pickup');

    // 9. OTP Verification: Test invalid OTP rejection
    console.log('[TEST 9] Driver tests starting ride with WRONG OTP (Must fail 400)...');
    const wrongOtpRes = await fetch(`${baseUrl}/rides/${bookingId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverAToken}`
      },
      body: JSON.stringify({ otp: '0000' })
    });
    assert(wrongOtpRes.status === 400, 'Wrong OTP must be rejected with 400');
    console.log('  -> PASS: Invalid OTP rejected');

    // 10. Start Ride with Valid OTP
    console.log('[TEST 10] Driver starts ride with VALID passenger OTP...');
    const startRideRes = await fetch(`${baseUrl}/rides/${bookingId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverAToken}`
      },
      body: JSON.stringify({ otp: rideOtp })
    });
    const startRideJson = await startRideRes.json() as any;
    assert(startRideRes.status === 200, 'Valid OTP should start ride');
    assert(startRideJson.data.status === BookingStatus.IN_PROGRESS, 'Status is now IN_PROGRESS');
    assert(!!startRideJson.data.startTime, 'Start time is recorded');
    console.log('  -> PASS: Ride started with valid OTP verification');

    // 11. Complete Ride & Settle Wallet
    console.log('[TEST 11] Driver completes ride with toll charges and settles wallet...');
    const completeRes = await fetch(`${baseUrl}/rides/${bookingId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverAToken}`
      },
      body: JSON.stringify({
        actualDistanceKm: 7.5,
        tollCharges: 40
      })
    });
    const completeJson = await completeRes.json() as any;
    assert(completeRes.status === 200, 'Ride completion should succeed');
    assert(completeJson.data.booking.status === BookingStatus.COMPLETED, 'Status is COMPLETED');
    assert(completeJson.data.finalFare > 0, 'Final fare calculated');
    assert(completeJson.data.driverEarnings > 0, 'Driver net earnings calculated');
    console.log(`  -> PASS: Final Fare: ₹${completeJson.data.finalFare}, Driver Earnings: ₹${completeJson.data.driverEarnings}`);

    // Verify Driver Wallet Balance in DB
    const driverUser = await db.users.findByPhone('+919876500002');
    const driverWallet = await db.wallets.findByUserId(driverUser!.id);
    assert(driverWallet.balance > 0, 'Driver wallet must have positive balance credited');
    console.log(`  -> PASS: Driver Wallet balance verified: ₹${driverWallet.balance}`);

    // 12. Customer Rates Trip
    console.log('[TEST 12] Customer rates trip with 5 stars...');
    const rateRes = await fetch(`${baseUrl}/bookings/${bookingId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ score: 5, comment: 'Punctual, polite driver and very clean car!' })
    });
    assert(rateRes.status === 200, 'Rating submission should return 200');
    console.log('  -> PASS: Customer rating submitted and recorded');

    console.log('\n================================================================');
    console.log('ALL PHASE 3 CUSTOMER BOOKING & DISPATCH TESTS PASSED! (12/12)');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runPhase3Tests().catch((err) => {
  console.error('PHASE 3 TEST FAILED:', err);
  process.exit(1);
});
