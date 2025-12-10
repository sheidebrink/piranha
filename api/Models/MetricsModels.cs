namespace PiranhaAPI.Models;

public class Session
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int TotalClaims { get; set; }
}

public class Claim
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public string ClaimId { get; set; } = string.Empty;
    public string? ClaimNumber { get; set; }
    public string ClaimType { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DurationSeconds { get; set; }
}

public class MetricEvent
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public int? ClaimId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string EventData { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}

public class ClaimDetectedRequest
{
    public int SessionId { get; set; }
    public string ClaimId { get; set; } = string.Empty;
    public string? ClaimNumber { get; set; }
    public string? ClaimantName { get; set; }
    public string InsuranceType { get; set; } = string.Empty;
}

public class TrackEventRequest
{
    public int SessionId { get; set; }
    public int? ClaimId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public object EventData { get; set; } = new { };
}

public class SessionSummary
{
    public int ClaimsProcessed { get; set; }
    public double AvgClaimDuration { get; set; }
    public int TotalTimeSeconds { get; set; }
}

public class ClaimTypeMetrics
{
    public string ClaimType { get; set; } = string.Empty;
    public int TotalClaims { get; set; }
    public double AvgDuration { get; set; }
    public int MinDuration { get; set; }
    public int MaxDuration { get; set; }
}

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsAdmin { get; set; } = false;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}
