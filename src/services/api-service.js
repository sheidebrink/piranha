const axios = require('axios');

class ApiService {
    constructor(baseUrl = 'http://localhost:5000/api') {
        this.baseUrl = baseUrl;
        this.isConnected = false;
        this.sessionId = null;
        this.currentClaimId = null;
    }

    async checkConnection() {
        try {
            const response = await axios.get(`${this.baseUrl}/metrics/health`, { timeout: 3000 });
            this.isConnected = response.status === 200;
            console.log('✅ API connection successful');
            return true;
        } catch (error) {
            this.isConnected = false;
            console.log('❌ API connection failed:', error.message);
            return false;
        }
    }

    async startSession(userId) {
        if (!this.isConnected) return null;

        try {
            const response = await axios.post(`${this.baseUrl}/metrics/session/start`, 
                JSON.stringify(userId),
                { headers: { 'Content-Type': 'application/json' } }
            );
            this.sessionId = response.data.id;
            console.log('Session started:', this.sessionId);
            return response.data;
        } catch (error) {
            console.error('Failed to start session:', error.message);
            return null;
        }
    }

    async startClaim(claimData) {
        if (!this.isConnected || !this.sessionId) return null;

        try {
            const response = await axios.post(`${this.baseUrl}/metrics/claim/start`, {
                sessionId: this.sessionId,
                claimId: claimData.claimId,
                claimNumber: claimData.claimNumber,
                claimantName: claimData.claimantName,
                insuranceType: claimData.insuranceType
            });
            this.currentClaimId = response.data.id;
            console.log('Claim started:', this.currentClaimId);
            return response.data;
        } catch (error) {
            console.error('Failed to start claim:', error.message);
            return null;
        }
    }

    async endClaim() {
        if (!this.isConnected || !this.currentClaimId) return null;

        try {
            const response = await axios.post(`${this.baseUrl}/metrics/claim/end/${this.currentClaimId}`);
            console.log('Claim ended:', this.currentClaimId);
            const claimId = this.currentClaimId;
            this.currentClaimId = null;
            return response.data;
        } catch (error) {
            console.error('Failed to end claim:', error.message);
            return null;
        }
    }

    async trackEvent(eventData) {
        if (!this.isConnected || !this.sessionId) return null;

        try {
            await axios.post(`${this.baseUrl}/metrics/event`, {
                sessionId: this.sessionId,
                claimId: this.currentClaimId,
                eventType: eventData.type,
                eventData: eventData
            });
        } catch (error) {
            console.error('Failed to track event:', error.message);
        }
    }

    async getSessionSummary() {
        if (!this.isConnected || !this.sessionId) return null;

        try {
            const response = await axios.get(`${this.baseUrl}/metrics/session/${this.sessionId}/summary`);
            return response.data;
        } catch (error) {
            console.error('Failed to get session summary:', error.message);
            return null;
        }
    }

    async getMetrics() {
        if (!this.isConnected) return null;

        try {
            const response = await axios.get(`${this.baseUrl}/metrics/metrics`);
            return response.data;
        } catch (error) {
            console.error('Failed to get metrics:', error.message);
            return null;
        }
    }
}

module.exports = ApiService;
