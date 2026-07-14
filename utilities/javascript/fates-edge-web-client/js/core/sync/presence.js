/**
 * Presence Manager - Track connected clients
 */

export class PresenceManager {
    constructor() {
        this.clients = new Map();
        this.localClientId = null;
    }
    
    /**
     * Update client list
     */
    updateClients(clients) {
        this.clients.clear();
        if (Array.isArray(clients)) {
            clients.forEach(client => {
                if (client.id) {
                    this.clients.set(client.id, client);
                }
            });
        }
    }
    
    /**
     * Add or update a client
     */
    updateClient(client) {
        if (client.id) {
            this.clients.set(client.id, client);
        }
    }
    
    /**
     * Remove a client
     */
    removeClient(clientId) {
        this.clients.delete(clientId);
    }
    
    /**
     * Get all online clients
     */
    getOnlineClients() {
        return Array.from(this.clients.values());
    }
    
    /**
     * Get client count
     */
    getClientCount() {
        return this.clients.size;
    }
    
    /**
     * Set local client ID
     */
    setLocalClientId(id) {
        this.localClientId = id;
    }
    
    /**
     * Get local client info
     */
    getLocalClient() {
        return this.localClientId ? this.clients.get(this.localClientId) : null;
    }
    
    /**
     * Get other clients (excluding local)
     */
    getOtherClients() {
        if (!this.localClientId) {
            return this.getOnlineClients();
        }
        return Array.from(this.clients.values()).filter(client => client.id !== this.localClientId);
    }
}
