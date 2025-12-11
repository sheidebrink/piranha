const axios = require('axios');

class ApiService {
    constructor(baseUrl = 'http://localhost:5555/api') {
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

    async startSession(username) {
        if (!this.isConnected) return null;

        try {
            const response = await axios.post(`${this.baseUrl}/metrics/session/start`, 
                JSON.stringify(username),
                { headers: { 'Content-Type': 'application/json' } }
            );
            this.sessionId = response.data.id;
            this.userEmail = response.data.userEmail;
            this.isAdmin = response.data.isAdmin;
            console.log('Session started:', this.sessionId, 'Email:', this.userEmail);
            return response.data;
        } catch (error) {
            console.error('Failed to start session:', error.message);
            return null;
        }
    }

    async getUser(username) {
        if (!this.isConnected) return null;

        try {
            const response = await axios.get(`${this.baseUrl}/metrics/user/${username}`);
            return response.data;
        } catch (error) {
            console.error('Failed to get user:', error.message);
            return null;
        }
    }

    async getAllUsers() {
        if (!this.isConnected) return null;

        try {
            const response = await axios.get(`${this.baseUrl}/metrics/users`);
            return response.data;
        } catch (error) {
            console.error('Failed to get all users:', error.message);
            return null;
        }
    }

    async updateUser(userId, userData) {
        if (!this.isConnected) return null;

        try {
            console.log('API Service updateUser:', { userId, userData, url: `${this.baseUrl}/metrics/user/${userId}` });
            const response = await axios.put(`${this.baseUrl}/metrics/user/${userId}`, userData);
            console.log('API Service updateUser response:', response.status, response.data);
            return response.data;
        } catch (error) {
            console.error('Failed to update user:', error.message);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
            
            // Throw the error with the server message if available
            if (error.response?.data?.message) {
                throw new Error(error.response.data.message);
            } else if (error.response?.status === 400) {
                throw new Error('Bad request - please check the email format and try again');
            } else {
                throw new Error(`Failed to update user: ${error.message}`);
            }
        }
    }

    async deleteUser(userId) {
        if (!this.isConnected) return null;

        try {
            const response = await axios.delete(`${this.baseUrl}/metrics/user/${userId}`);
            return response.data;
        } catch (error) {
            console.error('Failed to delete user:', error.message);
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
