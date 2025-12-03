const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
const fs = require('fs');
const path = require('path');

class EmailService {
    constructor() {
        this.config = this.loadConfig();
        this.msalClient = null;
        this.graphClient = null;
        this.accessToken = null;
    }

    loadConfig() {
        const configPath = path.join(__dirname, '../../config/email-config.json');
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    async initialize() {
        const msalConfig = {
            auth: {
                clientId: this.config.O365.appId,
                authority: `https://login.microsoftonline.com/${this.config.O365.tenantId}`,
                clientSecret: this.config.O365.clientSecret
            }
        };

        this.msalClient = new ConfidentialClientApplication(msalConfig);
    }

    async getAccessToken(userEmail) {
        try {
            const tokenRequest = {
                scopes: this.config.O365.scopes
            };

            const response = await this.msalClient.acquireTokenByClientCredential(tokenRequest);
            this.accessToken = response.accessToken;
            
            // Initialize Graph client
            this.graphClient = Client.init({
                authProvider: (done) => {
                    done(null, this.accessToken);
                }
            });

            return this.accessToken;
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    async getEmails(userEmail, options = {}) {
        if (!this.graphClient) {
            await this.getAccessToken(userEmail);
        }

        try {
            const {
                top = 50,
                skip = 0,
                folder = 'inbox',
                filter = null
            } = options;

            let query = this.graphClient
                .api(`/users/${userEmail}/mailFolders/${folder}/messages`)
                .top(top)
                .skip(skip)
                .select('id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments')
                .orderby('receivedDateTime DESC');

            if (filter) {
                query = query.filter(filter);
            }

            const result = await query.get();
            return result.value;
        } catch (error) {
            console.error('Error fetching emails:', error);
            throw error;
        }
    }

    async getEmailBody(userEmail, messageId) {
        if (!this.graphClient) {
            await this.getAccessToken(userEmail);
        }

        try {
            const message = await this.graphClient
                .api(`/users/${userEmail}/messages/${messageId}`)
                .select('id,subject,from,receivedDateTime,body,toRecipients,ccRecipients,hasAttachments')
                .get();

            return message;
        } catch (error) {
            console.error('Error fetching email body:', error);
            throw error;
        }
    }

    async markAsRead(userEmail, messageId) {
        if (!this.graphClient) {
            await this.getAccessToken(userEmail);
        }

        try {
            await this.graphClient
                .api(`/users/${userEmail}/messages/${messageId}`)
                .update({ isRead: true });
        } catch (error) {
            console.error('Error marking email as read:', error);
            throw error;
        }
    }

    async searchEmails(userEmail, searchQuery) {
        if (!this.graphClient) {
            await this.getAccessToken(userEmail);
        }

        try {
            const result = await this.graphClient
                .api(`/users/${userEmail}/messages`)
                .search(`"${searchQuery}"`)
                .top(25)
                .select('id,subject,from,receivedDateTime,bodyPreview,isRead')
                .get();

            return result.value;
        } catch (error) {
            console.error('Error searching emails:', error);
            throw error;
        }
    }

    async getFolders(userEmail) {
        if (!this.graphClient) {
            await this.getAccessToken(userEmail);
        }

        try {
            const result = await this.graphClient
                .api(`/users/${userEmail}/mailFolders`)
                .select('id,displayName,unreadItemCount,totalItemCount')
                .get();

            return result.value;
        } catch (error) {
            console.error('Error fetching folders:', error);
            throw error;
        }
    }
}

module.exports = EmailService;
