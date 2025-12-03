# Email Integration

## Overview
The app now includes an integrated email inbox that connects to Office 365 using Microsoft Graph API. Adjusters can view their emails without leaving the app.

## Features

### Email Inbox
- **View Inbox**: See latest 50 emails
- **Read Emails**: Click to read full email content
- **Mark as Read**: Automatically marks emails as read when opened
- **Search**: Search emails by subject, sender, or content
- **Folders**: Access Inbox, Sent, and Drafts

### Configuration
Email settings are stored in `config/email-config.json`:
- **App ID**: Azure AD application ID
- **Client Secret**: Application secret for authentication
- **Tenant ID**: Office 365 tenant ID
- **User Email**: mhuss@cbcsclaims.com

### Authentication
Uses **Client Credentials Flow** (app-only authentication):
- No user login required
- App authenticates with Azure AD
- Accesses mailbox on behalf of the application
- Requires admin consent for Mail.Read permissions

## Usage

1. Click the **📧 Email** button in the top toolbar
2. Email inbox opens in a new window
3. Browse emails in the list
4. Click an email to read it
5. Use search to find specific emails

## Technical Details

### Microsoft Graph API
- **Endpoint**: `https://graph.microsoft.com/v1.0`
- **Permissions**: Mail.Read, Mail.ReadWrite
- **Authentication**: MSAL (Microsoft Authentication Library)

### API Calls
- `GET /users/{email}/mailFolders/inbox/messages` - Get inbox emails
- `GET /users/{email}/messages/{id}` - Get email details
- `PATCH /users/{email}/messages/{id}` - Mark as read
- `GET /users/{email}/messages?$search="{query}"` - Search emails

### Data Displayed
- **Email List**: From, Subject, Preview, Time
- **Email Detail**: Full body, To/From, Date, Attachments indicator
- **Unread Count**: Badge on Inbox folder

## Benefits for Adjusters

1. **No Context Switching**: Read emails without leaving the app
2. **Claim Context**: Can reference emails while working on claims
3. **Quick Search**: Find emails related to current claim
4. **Unified Interface**: Everything in one window

## Future Enhancements

- **Reply/Forward**: Send emails from within the app
- **Attachments**: Download and view attachments
- **Link to Claims**: Associate emails with specific claims
- **Email Templates**: Quick responses for common scenarios
- **Notifications**: Desktop notifications for new emails
- **Multiple Accounts**: Support for multiple email accounts
- **Drag & Drop**: Drag emails to claims to attach them

## Security

- Client secret stored in config file (should be encrypted in production)
- Uses OAuth 2.0 for authentication
- No passwords stored
- Tokens cached securely by MSAL
- All communication over HTTPS

## Troubleshooting

### "Failed to load emails"
- Check internet connection
- Verify Azure AD app credentials
- Ensure app has Mail.Read permissions
- Check if admin consent is granted

### "Authentication failed"
- Verify client secret is correct
- Check tenant ID matches your Office 365 tenant
- Ensure app registration is active in Azure AD

### "No emails found"
- User may have empty inbox
- Check folder selection (Inbox/Sent/Drafts)
- Try refreshing with the ↻ button
