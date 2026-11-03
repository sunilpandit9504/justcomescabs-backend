"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSeed = runSeed;
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_js_1 = require("./services/db.js");
const shared_1 = require("@gatigo/shared");
const logger_js_1 = require("./common/logger.js");
async function runSeed() {
    logger_js_1.logger.info('Running database seed initialization...');
    // 1. Primary Justcomes Super Admin
    const primaryAdminEmail = 'admin@justcomes.in';
    let primaryAdmin = await db_js_1.db.users.findByEmail(primaryAdminEmail);
    if (!primaryAdmin) {
        primaryAdmin = await db_js_1.db.users.create({
            phone: '+919504329735',
            email: primaryAdminEmail,
            name: 'Justcomes Chief Admin',
            preferredLanguage: 'hi',
            role: shared_1.UserRole.SUPER_ADMIN,
            isActive: true,
            isVerified: true
        });
        const passwordHash = await bcrypt_1.default.hash('Priyansh@9504', 10);
        await db_js_1.db.adminUsers.create({
            userId: primaryAdmin.id,
            department: 'CENTRAL_OPERATIONS',
            passwordHash
        });
        logger_js_1.logger.info(`Super Admin seeded: ${primaryAdminEmail} (Password: Priyansh@9504)`);
    }
    // 2. Secondary GatiGo Admin for legacy / compatibility
    const secondaryAdminEmail = 'admin@gatigo.in';
    let secondaryAdmin = await db_js_1.db.users.findByEmail(secondaryAdminEmail);
    if (!secondaryAdmin) {
        secondaryAdmin = await db_js_1.db.users.create({
            phone: '+919876599999',
            email: secondaryAdminEmail,
            name: 'GatiGo Chief Admin',
            preferredLanguage: 'en',
            role: shared_1.UserRole.SUPER_ADMIN,
            isActive: true,
            isVerified: true
        });
        const passwordHash = await bcrypt_1.default.hash('AdminPassword@2026', 10);
        await db_js_1.db.adminUsers.create({
            userId: secondaryAdmin.id,
            department: 'CENTRAL_OPERATIONS',
            passwordHash
        });
        logger_js_1.logger.info(`Super Admin seeded: ${secondaryAdminEmail} (Password: AdminPassword@2026)`);
    }
    // NOTE: All dummy drivers (Suresh Mahto, Ramesh Kumar, Vikram Singh) and dummy customers
    // have been completely removed as requested. Real drivers registering from the mobile
    // app will be stored dynamically in the database.
    logger_js_1.logger.info('Database seed completed successfully with zero dummy driver data.');
}
