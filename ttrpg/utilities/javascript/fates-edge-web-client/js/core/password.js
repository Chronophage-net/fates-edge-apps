/**
 * Password Module - Secure toolkit access
 * 
 * Features:
 * - Password protection with SHA-256 hashing
 * - Persistent unlock state via localStorage
 * - Build-time password enforcement
 * - Session timeout
 * - Graceful degradation
 */

// ============================================================
// SAFE IMPORTS WITH FALLBACKS
// ============================================================

// Import modules safely - using dynamic import inside functions to avoid top-level await
let stateModule = null;
let toastModule = null;
let modulesLoaded = false;

async function loadModules() {
    if (modulesLoaded) return;
    try {
        stateModule = await import('./state.js');
    } catch (e) {
        console.warn('State module not available, using mock:', e);
        stateModule = {
            loadState: () => ({}),
            saveState: () => {},
            getState: () => ({ passwordHash: '' }),
            clearState: () => {},
            onSave: () => {},
            updateState: (u) => u,
            mergeState: (u) => u,
            getBaseUrl: () => '/'
        };
    }

    try {
        toastModule = await import('../components/Toast.js');
    } catch (e) {
        console.warn('Toast module not available, using mock:', e);
        toastModule = { 
            showToast: (msg) => console.log('Toast:', msg) 
        };
    }
    modulesLoaded = true;
}

// Helper functions that load modules on demand
async function getState() {
    await loadModules();
    return stateModule.getState();
}

async function saveState(data) {
    await loadModules();
    return stateModule.saveState(data);
}

async function clearState() {
    await loadModules();
    return stateModule.clearState();
}

async function loadState() {
    await loadModules();
    return stateModule.loadState();
}

async function showToast(msg, type) {
    await loadModules();
    if (toastModule && toastModule.showToast) {
        toastModule.showToast(msg, type);
    } else {
        console.log(`Toast [${type || 'info'}]:`, msg);
    }
}

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    UNLOCK_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
    MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION: 5 * 60 * 1000, // 5 minutes
};

// ============================================================
// STATE
// ============================================================

let unlockState = {
    isUnlocked: false,
    unlockTime: null,
    sessionTimeout: null,
    failedAttempts: 0,
    lockoutUntil: null,
    buildLocked: false,
};

let unlockCallbacks = [];
let lockCallbacks = [];

// ============================================================
// HASHING UTILITIES
// ============================================================

/**
 * Hash a password using SHA-256
 */
export async function hashPassword(password) {
    if (!password) {
        throw new Error('Password is required for hashing');
    }
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error('Hash password failed:', e);
        throw e;
    }
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
    if (!password || !hash) {
        console.warn('Missing password or hash for verification');
        return false;
    }
    try {
        const hashed = await hashPassword(password);
        const isValid = hashed === hash;
        console.log('Password verification:', isValid ? '✅ valid' : '❌ invalid');
        return isValid;
    } catch (e) {
        console.error('Password verification failed:', e);
        return false;
    }
}

// ============================================================
// BUILD LOCK DETECTION
// ============================================================

/**
 * Check if the toolkit is build-locked (requires password)
 */
export async function checkBuildLock() {
    console.log('🔍 Checking build lock...');
    
    try {
        // Check for build lock file in various locations
        const paths = [
            './build-lock.json',
            '/build-lock.json',
            '../build-lock.json',
            'build/build-lock.json',
            '/build/build-lock.json',
            '/build/html/build-lock.json'
        ];
        
        for (const path of paths) {
            try {
                console.log('Checking build lock path:', path);
                const response = await fetch(path, { 
                    cache: 'no-cache',
                    headers: { 'Accept': 'application/json' }
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log('Build lock response:', data);
                    if (data && data.locked === true) {
                        unlockState.buildLocked = true;
                        console.log('🔒 Build lock detected:', path);
                        return true;
                    }
                }
            } catch (e) {
                // Continue to next path
                console.debug('Build lock path failed:', path, e.message);
            }
        }
        
        unlockState.buildLocked = false;
        console.log('🔓 No build lock detected');
        return false;
    } catch (e) {
        console.warn('Error checking build lock (continuing without lock):', e);
        unlockState.buildLocked = false;
        return false;
    }
}

/**
 * Set build lock state manually (for testing)
 */
export function setBuildLock(locked) {
    console.log('Setting build lock:', locked);
    unlockState.buildLocked = locked;
}

// ============================================================
// CORE PASSWORD FUNCTIONS
// ============================================================

/**
 * Check if the toolkit is password protected
 */
export async function isPasswordProtected() {
    try {
        await loadModules();
        const appState = stateModule.getState();
        const result = !!(appState.passwordHash || unlockState.buildLocked);
        console.log('Password protected check:', result);
        return result;
    } catch (e) {
        console.error('Error checking password protection:', e);
        return false;
    }
}

/**
 * Check if the toolkit is currently unlocked
 */
export async function isToolkitUnlocked() {
    try {
        const isProtected = await isPasswordProtected();
        if (!isProtected) {
            console.log('🔓 No password protection required');
            return true;
        }
        const unlocked = unlockState.isUnlocked && !isSessionExpired();
        return unlocked;
    } catch (e) {
        console.error('Error checking unlock status:', e);
        return false;
    }
}

/**
 * UNLOCK THE TOOLKIT - The missing export that app.js needs
 * This function is called by app.js after successful password verification
 */
export function unlockToolkit() {
    console.log('🔓 Unlocking toolkit via unlockToolkit()...');
    
    // Set unlock state
    unlockState.isUnlocked = true;
    unlockState.unlockTime = Date.now();
    unlockState.failedAttempts = 0;
    unlockState.lockoutUntil = null;
    
    // Store unlock in localStorage for persistence
    try {
        localStorage.setItem('fates-edge-unlock', JSON.stringify({
            unlocked: true,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('Could not save unlock state:', e);
    }
    
    // Remove password overlay if it exists
    removePasswordOverlay();
    
    // Notify listeners
    notifyUnlocked();
    
    // Show success message
    showToast('Toolkit unlocked successfully!', 'success');
    
    console.log('✅ Toolkit unlocked');
    return true;
}

/**
 * Check if the session has expired
 */
function isSessionExpired() {
    if (!unlockState.unlockTime) {
        return true;
    }
    const elapsed = Date.now() - unlockState.unlockTime;
    return elapsed > CONFIG.SESSION_TIMEOUT;
}

/**
 * Get the current unlock status
 */
export async function getUnlockStatus() {
    const isUnlocked = await isToolkitUnlocked();
    const isProtected = await isPasswordProtected();
    await loadModules();
    const appState = stateModule.getState();
    return {
        isUnlocked: isUnlocked,
        isLocked: isProtected && !isUnlocked,
        isBuildLocked: unlockState.buildLocked,
        hasPassword: !!appState.passwordHash,
        sessionExpired: isSessionExpired(),
        unlockTime: unlockState.unlockTime,
        sessionTimeout: CONFIG.SESSION_TIMEOUT,
    };
}

// ============================================================
// PASSWORD CHECK AND UNLOCK
// ============================================================

/**
 * Check password gate - main entry point
 */
export async function checkPasswordGate(passwordHash, onUnlock, onLock) {
    console.log('🔐 Initializing password gate...');
    
    try {
        // Load modules first
        await loadModules();
        
        // Check build lock first
        const isBuildLocked = await checkBuildLock();
        
        if (!passwordHash && !isBuildLocked) {
            console.log('🔓 No password required');
            unlockState.isUnlocked = true;
            unlockState.unlockTime = Date.now();
            if (onUnlock) {
                console.log('Calling onUnlock callback');
                onUnlock();
            }
            return true;
        }
        
        // Check if we have a stored unlock
        if (passwordHash && isUnlockedRecently()) {
            console.log('🔓 Unlocked from session');
            unlockState.isUnlocked = true;
            unlockState.unlockTime = Date.now();
            if (onUnlock) {
                console.log('Calling onUnlock callback');
                onUnlock();
            }
            return true;
        }
        
        // Show password overlay
        console.log('🔐 Password required - showing overlay');
        showPasswordOverlay(passwordHash, onUnlock, onLock);
        return false;
    } catch (e) {
        console.error('Error in password gate:', e);
        // Fail open - don't lock users out due to errors
        console.log('⚠️ Error in password system, failing open');
        unlockState.isUnlocked = true;
        if (onUnlock) onUnlock();
        return true;
    }
}

/**
 * Check if the toolkit was unlocked recently
 */
function isUnlockedRecently() {
    try {
        const saved = localStorage.getItem('fates-edge-unlock');
        if (!saved) return false;
        
        const data = JSON.parse(saved);
        const elapsed = Date.now() - data.timestamp;
        return data.unlocked && elapsed < CONFIG.UNLOCK_DURATION;
    } catch (e) {
        console.warn('Error checking saved unlock:', e);
        return false;
    }
}

/**
 * Attempt to unlock with a password
 */
export async function attemptUnlock(password) {
    console.log('Attempting unlock...');
    
    try {
        await loadModules();
        const appState = stateModule.getState();
        const passwordHash = appState.passwordHash;
        
        // Check lockout
        if (unlockState.lockoutUntil && Date.now() < unlockState.lockoutUntil) {
            const remaining = Math.ceil((unlockState.lockoutUntil - Date.now()) / 1000 / 60);
            return { 
                success: false, 
                error: `Too many failed attempts. Try again in ${remaining} minute(s).`,
                locked: true
            };
        }
        
        // Verify password
        const isValid = await verifyPassword(password, passwordHash);
        
        if (isValid) {
            // Success - use unlockToolkit to handle the unlock logic
            unlockToolkit();
            return { success: true };
        } else {
            // Failure
            console.log('❌ Password incorrect');
            unlockState.failedAttempts++;
            
            if (unlockState.failedAttempts >= CONFIG.MAX_ATTEMPTS) {
                unlockState.lockoutUntil = Date.now() + CONFIG.LOCKOUT_DURATION;
                return {
                    success: false,
                    error: `Too many failed attempts. Locked for ${CONFIG.LOCKOUT_DURATION / 1000 / 60} minutes.`,
                    locked: true
                };
            }
            
            return {
                success: false,
                error: `Invalid password. ${CONFIG.MAX_ATTEMPTS - unlockState.failedAttempts} attempts remaining.`,
                attempts: unlockState.failedAttempts
            };
        }
    } catch (e) {
        console.error('Error during unlock attempt:', e);
        return {
            success: false,
            error: 'System error during unlock attempt'
        };
    }
}

/**
 * Lock the toolkit
 */
export function lockToolkit() {
    console.log('🔒 Locking toolkit');
    unlockState.isUnlocked = false;
    unlockState.unlockTime = null;
    localStorage.removeItem('fates-edge-unlock');
    notifyLocked();
    showToast('Toolkit locked', 'info');
}

/**
 * Clear the password (admin function)
 */
export async function clearPassword() {
    console.log('Clearing password...');
    try {
        await loadModules();
        stateModule.clearState();
        
        localStorage.removeItem('fates-edge-unlock');
        unlockState.buildLocked = false;
        removePasswordOverlay();
        
        unlockState.isUnlocked = true;
        unlockState.unlockTime = Date.now();
        
        showToast('Password cleared', 'success');
        notifyUnlocked();
        return true;
    } catch (e) {
        console.error('Failed to clear password:', e);
        return false;
    }
}

// ============================================================
// PASSWORD OVERLAY UI
// ============================================================

function showPasswordOverlay(passwordHash, onUnlock, onLock) {
    console.log('Showing password overlay...');
    
    try {
        removePasswordOverlay();
        
        const overlay = document.createElement('div');
        overlay.id = 'password-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
        `;
        
        overlay.innerHTML = `
            <div style="
                background: var(--bg2, #2a2a2a);
                border-radius: 12px;
                padding: 0;
                min-width: 380px;
                max-width: 90vw;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                color: var(--text, #e0e0e0);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    background: var(--bg3, #333);
                    padding: 1.2rem 1.5rem;
                    border-radius: 12px 12px 0 0;
                    border-bottom: 1px solid var(--border, #444);
                ">
                    <h3 style="margin: 0; font-size: 1.3rem; display: flex; align-items: center; gap: 0.5rem;">
                        🔐 Enter Password
                    </h3>
                </div>
                <div style="padding: 1.5rem;">
                    <p style="margin: 0 0 1.2rem 0; color: var(--text2, #aaa); font-size: 0.95rem; line-height: 1.5;">
                        This toolkit is password protected.
                        ${unlockState.buildLocked ? '<br><small style="color: #ffcc00;">⚙️ Build lock is active</small>' : ''}
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                        <div>
                            <input type="password" id="password-input" placeholder="Enter password" 
                                   style="
                                       width: 100%;
                                       padding: 0.8rem 1rem;
                                       font-size: 1.1rem;
                                       background: var(--bg3, #3a3a3a);
                                       border: 2px solid var(--border, #555);
                                       border-radius: 6px;
                                       color: var(--text, white);
                                       transition: border-color 0.2s;
                                       box-sizing: border-box;
                                   " 
                                   autofocus />
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button id="password-submit" style="
                                flex: 1;
                                padding: 0.8rem 1.2rem;
                                background: var(--gold, #d4af37);
                                color: #000;
                                border: none;
                                border-radius: 6px;
                                font-weight: bold;
                                font-size: 1rem;
                                cursor: pointer;
                                transition: opacity 0.2s;
                            ">Unlock</button>
                            ${!unlockState.buildLocked ? `<button id="password-clear" style="
                                padding: 0.8rem 1.2rem;
                                background: var(--bg4, #555);
                                color: var(--text, white);
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 1rem;
                                transition: opacity 0.2s;
                            ">Clear</button>` : ''}
                        </div>
                    </div>
                    <div id="password-error" style="
                        color: #ff6b6b;
                        font-size: 0.85rem;
                        margin-top: 0.8rem;
                        display: none;
                    "></div>
                    <div id="password-attempts" style="
                        color: var(--text3, #888);
                        font-size: 0.8rem;
                        margin-top: 0.3rem;
                    "></div>
                    <div style="
                        margin-top: 1.2rem;
                        border-top: 1px solid var(--border, #444);
                        padding-top: 0.8rem;
                        font-size: 0.8rem;
                        color: var(--text3, #888);
                    ">
                        ${unlockState.buildLocked ? 
                            '🔒 Build lock is active.' : 
                            'Password is stored locally. Clear it via the build workflow if needed.'}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Event listeners
        const input = document.getElementById('password-input');
        const submitBtn = document.getElementById('password-submit');
        const errorEl = document.getElementById('password-error');
        const attemptsEl = document.getElementById('password-attempts');
        const clearBtn = document.getElementById('password-clear');
        
        if (input) {
            input.focus();
            input.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    await handlePasswordSubmit(input.value, passwordHash, onUnlock, onLock);
                }
            });
        }
        
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const val = input ? input.value : '';
                await handlePasswordSubmit(val, passwordHash, onUnlock, onLock);
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('Clear the password? This will remove the password protection.')) {
                    await clearPassword();
                    if (onUnlock) onUnlock();
                    removePasswordOverlay();
                }
            });
        }
        
        window.__passwordOverlay = { errorEl, attemptsEl, input };
        
    } catch (e) {
        console.error('Error showing password overlay:', e);
        if (onUnlock) onUnlock();
    }
}

async function handlePasswordSubmit(password, passwordHash, onUnlock, onLock) {
    try {
        const { errorEl, attemptsEl, input } = window.__passwordOverlay || {};
        
        if (!password || password.length < 1) {
            if (errorEl) {
                errorEl.textContent = 'Please enter a password.';
                errorEl.style.display = 'block';
            }
            return;
        }
        
        if (errorEl) {
            errorEl.style.display = 'none';
        }
        
        const result = await attemptUnlock(password);
        
        if (result.success) {
            // The unlockToolkit function is called inside attemptUnlock
            if (onUnlock) onUnlock();
            removePasswordOverlay();
        } else {
            if (errorEl) {
                errorEl.textContent = result.error || 'Invalid password.';
                errorEl.style.display = 'block';
            }
            if (attemptsEl && result.attempts !== undefined) {
                attemptsEl.textContent = `Attempts: ${result.attempts}/${CONFIG.MAX_ATTEMPTS}`;
            }
            if (input) {
                input.value = '';
                input.focus();
            }
            if (result.locked && onLock) {
                onLock();
            }
        }
    } catch (e) {
        console.error('Error in password submission:', e);
        const { errorEl } = window.__passwordOverlay || {};
        if (errorEl) {
            errorEl.textContent = 'System error. Please try again.';
            errorEl.style.display = 'block';
        }
    }
}

function removePasswordOverlay() {
    try {
        const existing = document.getElementById('password-overlay');
        if (existing) {
            existing.remove();
        }
        delete window.__passwordOverlay;
    } catch (e) {
        console.warn('Error removing overlay:', e);
    }
}

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================

function notifyUnlocked() {
    unlockCallbacks.forEach(cb => {
        try { cb(); } catch (e) {
            console.warn('Unlock callback error:', e);
        }
    });
    try {
        document.dispatchEvent(new CustomEvent('toolkit-unlocked'));
    } catch (e) {
        console.warn('Custom event dispatch failed:', e);
    }
}

function notifyLocked() {
    lockCallbacks.forEach(cb => {
        try { cb(); } catch (e) {
            console.warn('Lock callback error:', e);
        }
    });
    try {
        document.dispatchEvent(new CustomEvent('toolkit-locked'));
    } catch (e) {
        console.warn('Custom event dispatch failed:', e);
    }
}

export function onUnlock(callback) {
    if (typeof callback === 'function') {
        unlockCallbacks.push(callback);
    }
}

export function onLock(callback) {
    if (typeof callback === 'function') {
        lockCallbacks.push(callback);
    }
}

// ============================================================
// PASSWORD SETUP
// ============================================================

export async function setupPassword(password) {
    if (!password || password.length < 4) {
        throw new Error('Password must be at least 4 characters');
    }
    
    try {
        await loadModules();
        const hash = await hashPassword(password);
        const appState = stateModule.getState();
        appState.passwordHash = hash;
        stateModule.saveState(appState);
        
        localStorage.removeItem('fates-edge-unlock');
        unlockState.isUnlocked = false;
        
        showToast('Password set successfully', 'success');
        return true;
    } catch (e) {
        console.error('Failed to set password:', e);
        throw e;
    }
}

export async function isPasswordSet() {
    try {
        await loadModules();
        const appState = stateModule.getState();
        return !!appState.passwordHash;
    } catch (e) {
        console.error('Error checking password status:', e);
        return false;
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize the password module
 * Should be called once at app startup
 */
export async function initPasswordModule() {
    console.log('🔐 Initializing password module...');
    await loadModules();
    await loadState();
    console.log('🔐 Password module initialized');
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    checkPasswordGate,
    isToolkitUnlocked,
    unlockToolkit,  // NOW EXPORTED!
    isPasswordProtected,
    attemptUnlock,
    lockToolkit,
    clearPassword,
    setupPassword,
    isPasswordSet,
    getUnlockStatus,
    onUnlock,
    onLock,
    setBuildLock,
    checkBuildLock,
    verifyPassword,
    hashPassword,
    initPasswordModule,
};