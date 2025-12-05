# Piranha Metrics API

.NET 9.0 Web API for tracking Piranha app metrics.

## Features

- Session tracking
- Claim tracking with duration
- Event logging
- Metrics aggregation by claim type
- SQLite database storage
- CORS enabled for Electron app

## Running the API

```bash
cd api
dotnet run
```

The API will start on `http://localhost:5000`

## Endpoints

### Health Check
```
GET /api/metrics/health
```

### Session Management
```
POST /api/metrics/session/start
Body: "user_id"
```

### Claim Tracking
```
POST /api/metrics/claim/start
Body: {
  "sessionId": 1,
  "claimId": "716218",
  "claimNumber": "WC2000090249",
  "claimantName": "John Doe",
  "insuranceType": "1"
}

POST /api/metrics/claim/end/{claimId}
```

### Event Tracking
```
POST /api/metrics/event
Body: {
  "sessionId": 1,
  "claimId": 1,
  "eventType": "navigation",
  "eventData": { "url": "..." }
}
```

### Metrics
```
GET /api/metrics/session/{sessionId}/summary
GET /api/metrics/metrics
```

## Database

SQLite database file: `piranha_metrics.db`

Tables:
- sessions
- claims
- events

## Development

The API uses Entity Framework Core with SQLite. The database is created automatically on first run.

To add migrations:
```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```
