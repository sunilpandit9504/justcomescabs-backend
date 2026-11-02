"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_js_1 = require("../app.js");
const seed_js_1 = require("../seed.js");
const shared_1 = require("@gatigo/shared");
// Minimal assertion helper
function assert(condition, msg) {
    if (!condition) {
        throw new Error(`TEST FAILED: ${msg}`);
    }
}
async function runTests() {
    console.log('--- STARTING PHASE 2 AUTHENTICATION & ACCESS CONTROL TESTS ---');
    // Seed initial data
    await (0, seed_js_1.runSeed)();
    const app = (0, app_js_1.createApp)();
    const server = http_1.default.createServer(app);
    await new Promise((resolve) => server.listen(5099, resolve));
    const baseUrl = 'http://localhost:5099/api/v1';
    try {
        // 1. Health check test
        console.log('[TEST 1] Testing /health endpoint...');
        const healthRes = await fetch('http://localhost:5099/health');
        const healthJson = await healthRes.json();
        assert(healthRes.status === 200, 'Health endpoint must return 200');
        assert(healthJson.status === 'HEALTHY', 'Service status should be HEALTHY');
        console.log('  -> PASS');
        // 2. Admin Login Test
        console.log('[TEST 2] Testing Super Admin Login...');
        const adminLoginRes = await fetch(`${baseUrl}/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@gatigo.in', password: 'AdminPassword@2026' })
        });
        const adminLoginJson = await adminLoginRes.json();
        assert(adminLoginRes.status === 200, 'Admin login should succeed with 200');
        assert(adminLoginJson.success === true, 'Admin login response success must be true');
        assert(!!adminLoginJson.data.accessToken, 'Admin access token must be present');
        const adminToken = adminLoginJson.data.accessToken;
        console.log('  -> PASS: Received Admin JWT');
        // 3. Customer OTP Send & Verify Test
        console.log('[TEST 3] Testing Customer OTP Flow for new customer...');
        const testPhone = '+919988776655';
        const otpSendRes = await fetch(`${baseUrl}/auth/otp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: testPhone, role: 'CUSTOMER' })
        });
        const otpSendJson = await otpSendRes.json();
        assert(otpSendRes.status === 200, 'OTP send must return 200');
        const sessionToken = otpSendJson.data.sessionToken;
        const devOtp = otpSendJson.data.devOtp || '123456';
        const otpVerifyRes = await fetch(`${baseUrl}/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: testPhone,
                otp: devOtp,
                sessionToken,
                role: 'CUSTOMER',
                name: 'Priya Kumari'
            })
        });
        const otpVerifyJson = await otpVerifyRes.json();
        assert(otpVerifyRes.status === 200, 'OTP verify must return 200');
        assert(otpVerifyJson.data.user.phone === testPhone, 'User phone matches');
        assert(otpVerifyJson.data.user.role === 'CUSTOMER', 'Role is CUSTOMER');
        assert(!!otpVerifyJson.data.accessToken, 'Customer access token must be returned');
        const customerToken = otpVerifyJson.data.accessToken;
        console.log('  -> PASS: New Customer authenticated with JWT');
        // 4. Test Customer Protected Profile Endpoint
        console.log('[TEST 4] Testing Customer accessing /customers/profile with JWT...');
        const profileRes = await fetch(`${baseUrl}/customers/profile`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        const profileJson = await profileRes.json();
        assert(profileRes.status === 200, 'Customer should be authorized to view profile');
        assert(profileJson.data.user.phone === testPhone, 'Customer profile phone matches');
        console.log('  -> PASS');
        // 5. Unauthorized access test (Missing JWT)
        console.log('[TEST 5] Testing access to protected endpoint without JWT (Should fail 401)...');
        const unauthRes = await fetch(`${baseUrl}/customers/profile`);
        assert(unauthRes.status === 401, 'Request without token must fail with 401 Unauthorized');
        console.log('  -> PASS: Correctly rejected 401');
        // 6. RBAC Forbidden test (Customer trying to access Admin API)
        console.log('[TEST 6] Testing Customer trying to access Admin Stats (Should fail 403)...');
        const forbiddenRes = await fetch(`${baseUrl}/admin/dashboard/stats`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        assert(forbiddenRes.status === 403, 'Customer accessing Admin endpoint must fail with 403 Forbidden');
        console.log('  -> PASS: Correctly rejected 403 Forbidden');
        // 7. Admin accessing Admin Stats
        console.log('[TEST 7] Testing Admin accessing Admin Stats...');
        const adminStatsRes = await fetch(`${baseUrl}/admin/dashboard/stats`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const adminStatsJson = await adminStatsRes.json();
        assert(adminStatsRes.status === 200, 'Admin should successfully access stats');
        assert(adminStatsJson.data.fleet.totalDrivers >= 3, 'Fleet drivers counted');
        console.log(`  -> PASS: Total drivers in system: ${adminStatsJson.data.fleet.totalDrivers}`);
        // 8. Driver KYC & Admin Approval Flow
        console.log('[TEST 8] Testing Driver KYC submission and Admin Approval...');
        // Seeded Driver C is in UNDER_REVIEW
        const pendingDriverRes = await fetch(`${baseUrl}/admin/drivers/pending-kyc`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const pendingDriverJson = await pendingDriverRes.json();
        assert(pendingDriverRes.status === 200, 'Admin should retrieve pending KYC drivers');
        const driverC = pendingDriverJson.data.find((item) => item.driver.kycStatus === shared_1.KycStatus.UNDER_REVIEW);
        assert(!!driverC, 'Driver C should be pending verification');
        // Admin verifies Driver C
        const verifyRes = await fetch(`${baseUrl}/admin/drivers/${driverC.driver.id}/verify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const verifyJson = await verifyRes.json();
        assert(verifyRes.status === 200, 'Admin verification should succeed');
        assert(verifyJson.data.kycStatus === shared_1.KycStatus.VERIFIED, 'Driver status should now be VERIFIED');
        console.log('  -> PASS: Driver C successfully verified by Admin');
        // 9. Driver Duty Online Toggle
        console.log('[TEST 9] Testing Driver Duty Online Toggle...');
        // Login as Driver A (Suresh Mahto)
        const driverALoginRes = await fetch(`${baseUrl}/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '+919876500002', otp: '123456', role: 'DRIVER' })
        });
        const driverALoginJson = await driverALoginRes.json();
        const driverAToken = driverALoginJson.data.accessToken;
        const toggleOnlineRes = await fetch(`${baseUrl}/drivers/availability/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${driverAToken}`
            },
            body: JSON.stringify({ isOnline: true, latitude: 23.3441, longitude: 85.3096 })
        });
        const toggleOnlineJson = await toggleOnlineRes.json();
        assert(toggleOnlineRes.status === 200, 'Duty toggle online should return 200');
        assert(toggleOnlineJson.data.isOnline === true, 'Driver duty is ONLINE');
        console.log('  -> PASS: Driver A toggled duty ONLINE');
        console.log('\n======================================================');
        console.log('ALL PHASE 2 AUTHENTICATION & ACCESS TESTS PASSED! (9/9)');
        console.log('======================================================\n');
    }
    finally {
        server.close();
    }
}
runTests().catch((err) => {
    console.error('TEST SUITE ERROR:', err);
    process.exit(1);
});
