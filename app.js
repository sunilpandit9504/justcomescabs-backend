// Justcomes Cab - Hostinger Node.js Application Startup File
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '5000';

console.log('Starting Justcomes Cab Backend API on Port:', process.env.PORT);
require('./dist/main.js');
