/**
 * Voice Chat Component - WebRTC peer-to-peer voice
 */

import { showToast } from './Toast.js';

export class VoiceChat {
    constructor() {
        this.localStream = null;
        this.remoteStreams = new Map();
        this.peerConnections = new Map();
        this.isMuted = false;
        this.isEnabled = false;
        this.audioContext = null;
        this.analyser = null;
        this.voiceActivity = 0;
        this.animationId = null;
        this.activityListeners = [];
        
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        this.audioConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000
        };
    }
    
    /**
     * Initialize voice chat
     */
    async init() {
        try {
            // Check if browser supports getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Browser does not support getUserMedia');
            }
            
            // Request microphone
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: this.audioConstraints,
                video: false
            });
            
            // Create audio context for analysis
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            source.connect(this.analyser);
            
            // Resume audio context (required by some browsers)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.isEnabled = true;
            
            // Start activity monitoring
            this.startActivityMonitoring();
            
            showToast('Voice chat initialized.', 'success');
            return true;
        } catch (err) {
            console.error('Voice init failed:', err);
            let message = 'Microphone access denied.';
            if (err.name === 'NotAllowedError') {
                message = 'Microphone access denied. Please allow microphone access in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                message = 'No microphone found. Please connect a microphone.';
            } else if (err.message) {
                message = err.message;
            }
            showToast(message, 'error');
            return false;
        }
    }
    
    /**
     * Create a peer connection for a client
     */
    createPeerConnection(clientId, onTrack, onIceCandidate, onConnectionStateChange) {
        if (this.peerConnections.has(clientId)) {
            return this.peerConnections.get(clientId);
        }
        
        const pc = new RTCPeerConnection(this.configuration);
        
        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }
        
        // Handle remote tracks
        pc.ontrack = (event) => {
            if (!this.remoteStreams.has(clientId)) {
                const stream = new MediaStream();
                this.remoteStreams.set(clientId, stream);
            }
            const stream = this.remoteStreams.get(clientId);
            event.streams[0].getTracks().forEach(track => {
                stream.addTrack(track);
            });
            if (onTrack) onTrack(clientId, stream);
        };
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && onIceCandidate) {
                onIceCandidate(clientId, event.candidate);
            }
        };
        
        // Handle connection state
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            if (state === 'connected') {
                console.log(`Voice connected to ${clientId}`);
            } else if (state === 'disconnected' || state === 'failed') {
                console.log(`Voice disconnected from ${clientId}`);
                this.cleanupPeerConnection(clientId);
            }
            if (onConnectionStateChange) {
                onConnectionStateChange(clientId, state);
            }
        };
        
        this.peerConnections.set(clientId, pc);
        return pc;
    }
    
    /**
     * Get peer connection
     */
    getPeerConnection(clientId) {
        return this.peerConnections.get(clientId);
    }
    
    /**
     * Cleanup peer connection
     */
    cleanupPeerConnection(clientId) {
        const pc = this.peerConnections.get(clientId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(clientId);
        }
        const stream = this.remoteStreams.get(clientId);
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            this.remoteStreams.delete(clientId);
        }
    }
    
    /**
     * Cleanup all connections
     */
    cleanup() {
        // Stop activity monitoring
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Close all peer connections
        this.peerConnections.forEach((pc) => pc.close());
        this.peerConnections.clear();
        this.remoteStreams.clear();
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.analyser = null;
        }
        
        this.isEnabled = false;
        this.isMuted = false;
        this.voiceActivity = 0;
        this.activityListeners = [];
    }
    
    /**
     * Toggle mute
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });
        }
        showToast(this.isMuted ? '🎤 Microphone muted.' : '🎤 Microphone unmuted.', 'info');
        return this.isMuted;
    }
    
    /**
     * Check if muted
     */
    isMutedState() {
        return this.isMuted;
    }
    
    /**
     * Get local stream for display
     */
    getLocalStream() {
        return this.localStream;
    }
    
    /**
     * Get remote stream for a client
     */
    getRemoteStream(clientId) {
        return this.remoteStreams.get(clientId);
    }
    
    /**
     * Get all remote streams
     */
    getRemoteStreams() {
        return this.remoteStreams;
    }
    
    /**
     * Start monitoring voice activity
     */
    startActivityMonitoring() {
        if (!this.analyser) return;
        
        const updateActivity = () => {
            if (!this.isEnabled || !this.analyser) {
                this.animationId = requestAnimationFrame(updateActivity);
                return;
            }
            
            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(dataArray);
            
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / (dataArray.length * 255);
            
            // Smooth the activity
            this.voiceActivity = this.voiceActivity * 0.7 + avg * 0.3;
            
            // Notify listeners
            this.activityListeners.forEach(cb => {
                try {
                    cb(this.voiceActivity);
                } catch (e) {
                    // Ignore
                }
            });
            
            this.animationId = requestAnimationFrame(updateActivity);
        };
        
        updateActivity();
    }
    
    /**
     * Register activity listener
     */
    onActivity(callback) {
        this.activityListeners.push(callback);
        return () => {
            const idx = this.activityListeners.indexOf(callback);
            if (idx !== -1) this.activityListeners.splice(idx, 1);
        };
    }
    
    /**
     * Get current voice activity level (0-1)
     */
    getVoiceActivity() {
        return this.voiceActivity;
    }
    
    /**
     * Check if enabled
     */
    isEnabledState() {
        return this.isEnabled;
    }
}
