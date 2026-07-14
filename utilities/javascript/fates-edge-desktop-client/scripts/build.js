#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================================
//  Configuration
// ============================================================

const CONFIG = {
    platforms: {
        mac: { name: 'macOS', cmd: 'build:mac', output: 'dmg' },
        win: { name: 'Windows', cmd: 'build:win', output: 'exe' },
        linux: { name: 'Linux', cmd: 'build:linux', output: 'AppImage' }
    }
};

// ============================================================
//  Utility Functions
// ============================================================

function log(message, type = 'info') {
    const icons = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warn: '⚠️',
        step: '📦',
        build: '🔨'
    };
    console.log(`${icons[type] || '📌'} ${message}`);
}

function getPlatform() {
    const platform = process.platform;
    if (platform === 'darwin') return 'mac';
    if (platform === 'win32') return 'win';
    if (platform === 'linux') return 'linux';
    return null;
}

function buildForPlatform(platform) {
    const config = CONFIG.platforms[platform];
    if (!config) {
        throw new Error(`Unknown platform: ${platform}`);
    }

    log(`Building for ${config.name}...`, 'build');
    
    try {
        // Clean dist directory
        const distPath = path.join(__dirname, '..', 'dist');
        if (fs.existsSync(distPath)) {
            log('Cleaning dist directory...', 'step');
            fs.rmSync(distPath, { recursive: true, force: true });
        }

        // Run build
        log(`Running npm run ${config.cmd}...`, 'step');
        execSync(`npm run ${config.cmd}`, { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });

        // Check output
        const outputPath = path.join(__dirname, '..', 'dist');
        if (!fs.existsSync(outputPath)) {
            throw new Error('Build output directory not found');
        }

        const files = fs.readdirSync(outputPath);
        const artifacts = files.map(f => {
            const stats = fs.statSync(path.join(outputPath, f));
            return {
                name: f,
                size: (stats.size / 1024 / 1024).toFixed(2),
                sizeBytes: stats.size
            };
        });

        log(`✅ Build successful for ${config.name}`, 'success');
        log(`📁 Artifacts (${artifacts.length} files):`, 'info');
        artifacts.forEach(a => {
            console.log(`  ${a.name} (${a.size} MB)`);
        });

        return { success: true, artifacts };
    } catch (error) {
        log(`❌ Build failed for ${config.name}: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

function buildAll() {
    log('🚀 Building for all platforms...', 'build');
    
    const results = {};
    const platforms = ['mac', 'win', 'linux'];
    
    for (const platform of platforms) {
        const result = buildForPlatform(platform);
        results[platform] = result;
        
        if (!result.success) {
            log(`⚠️ Build for ${platform} failed, continuing...`, 'warn');
        }
    }
    
    // Summary
    log('\n📊 Build Summary:', 'info');
    let successCount = 0;
    for (const [platform, result] of Object.entries(results)) {
        const status = result.success ? '✅' : '❌';
        const name = CONFIG.platforms[platform].name;
        console.log(`  ${status} ${name}: ${result.success ? 'Success' : 'Failed'}`);
        if (result.success) {
            successCount++;
        }
    }
    
    log(`\n✅ ${successCount}/${Object.keys(results).length} builds successful`, 
        successCount === Object.keys(results).length ? 'success' : 'warn');
    
    return results;
}

// ============================================================
//  Interactive Menu
// ============================================================

function showMenu() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const platform = getPlatform();
    const platformName = CONFIG.platforms[platform]?.name || 'Unknown';

    console.log('\n🎲 Fate\'s Edge Desktop Client - Build Tool\n');
    console.log(`📌 Current platform: ${platformName} (${platform})`);
    console.log('\nOptions:');
    console.log('  1. Build for current platform');
    console.log('  2. Build for all platforms');
    console.log('  3. Build for macOS');
    console.log('  4. Build for Windows');
    console.log('  5. Build for Linux');
    console.log('  6. Clean build directory');
    console.log('  7. Show help');
    console.log('  0. Exit');
    console.log('');

    rl.question('Select option: ', (answer) => {
        rl.close();
        
        switch (answer.trim()) {
            case '1':
                if (platform) {
                    buildForPlatform(platform);
                } else {
                    log('❌ Current platform not supported for building', 'error');
                }
                break;
            case '2':
                buildAll();
                break;
            case '3':
                buildForPlatform('mac');
                break;
            case '4':
                buildForPlatform('win');
                break;
            case '5':
                buildForPlatform('linux');
                break;
            case '6':
                cleanBuild();
                break;
            case '7':
                showHelp();
                showMenu();
                return;
            case '0':
                log('👋 Goodbye!');
                process.exit(0);
            default:
                log('❌ Invalid option', 'error');
                showMenu();
                return;
        }
        
        // Ask to continue
        const continueRl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        continueRl.question('\nPress Enter to continue or "q" to quit: ', (answer) => {
            continueRl.close();
            if (answer.trim().toLowerCase() === 'q') {
                log('👋 Goodbye!');
                process.exit(0);
            } else {
                showMenu();
            }
        });
    });
}

function cleanBuild() {
    const distPath = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distPath)) {
        log('🧹 Cleaning build directory...', 'step');
        fs.rmSync(distPath, { recursive: true, force: true });
        log('✅ Build directory cleaned', 'success');
    } else {
        log('ℹ️ Build directory not found, nothing to clean', 'info');
    }
}

function showHelp() {
    console.log('\n📖 Help - Fate\'s Edge Build Tool\n');
    console.log('Usage:');
    console.log('  node scripts/build.js [options]\n');
    console.log('Options:');
    console.log('  --platform=<platform>  Build for specific platform (mac|win|linux)');
    console.log('  --all                 Build for all platforms');
    console.log('  --clean               Clean build directory');
    console.log('  --help                Show this help\n');
    console.log('Examples:');
    console.log('  node scripts/build.js --platform=mac');
    console.log('  node scripts/build.js --all');
    console.log('  node scripts/build.js --clean');
    console.log('');
}

// ============================================================
//  CLI Entry Point
// ============================================================

function main() {
    const args = process.argv.slice(2);
    
    // Check for --help
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    
    // Check for --clean
    if (args.includes('--clean')) {
        cleanBuild();
        process.exit(0);
    }
    
    // Check for --all
    if (args.includes('--all')) {
        buildAll();
        process.exit(0);
    }
    
    // Check for --platform
    const platformArg = args.find(a => a.startsWith('--platform='));
    if (platformArg) {
        const platform = platformArg.split('=')[1];
        if (CONFIG.platforms[platform]) {
            buildForPlatform(platform);
            process.exit(0);
        } else {
            log(`❌ Unknown platform: ${platform}`, 'error');
            log(`Available platforms: ${Object.keys(CONFIG.platforms).join(', ')}`, 'info');
            process.exit(1);
        }
    }
    
    // No arguments - show interactive menu
    showMenu();
}

// Run main function
main();
