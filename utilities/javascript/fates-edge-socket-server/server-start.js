#!/usr/bin/env node
/**
 * Server Start Helper
 * Used by the CLI tool to start the server
 */

const server = require('./server.js');

// If run directly, start the server
if (require.main === module) {
    console.log('🚀 Starting Fate\'s Edge Server...');
    console.log(`📡 Version: ${require('./package.json').version}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // The server.js will handle the actual startup
    // It will listen on the PORT env var or default to 3000
}

module.exports = server;
