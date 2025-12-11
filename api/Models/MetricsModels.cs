namespace PiranhaAPI.Models;

public class Session
{
    public int Id { get; set; }
    public int UserId { get; set; }  // Foreign key to User.Id
    public string? Username { get; set; }  // Keep username for backward compatibility (nullable)
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int TotalClaims { get; set; }
    
    // Navigation properties
    public User User { get; set; } = null!;
    public ICollection<Claim> Claims { get; set; } = new List<Claim>();
    public ICollection<MetricEvent> Events { get; set; } = new List<MetricEvent>();
}

public class Claim
{
    public int Id { get; set; }
    public int SessionId { get; set; }  // Foreign key to Session.Id
    public string ClaimId { get; set; } = string.Empty;
    public string? ClaimNumber { get; set; }
    public string ClaimType { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DurationSeconds { get; set; }
    
    // Navigation properties
    public Session Session { get; set; } = null!;
    public ICollection<MetricEvent> Events { get; set; } = new List<MetricEvent>();
}

public class MetricEvent
{
    public int Id { get; set; }
    public int SessionId { get; set; }  // Foreign key to Session.Id
    public int? ClaimId { get; set; }   // Foreign key to Claim.Id (nullable)
    public string EventType { get; set; } = string.Empty;
    public string EventData { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    
    // Navigation properties
    public Session Session { get; set; } = null!;
    public Claim? Claim { get; set; }
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
    
    // Navigation properties
    public ICollection<Session> Sessions { get; set; } = new List<Session>();
}

public class UpdateUserRequest
{
    public string Email { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
}

public class UserMetrics
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int TotalSessions { get; set; }
    public int TotalClaims { get; set; }
    public double AvgClaimDuration { get; set; }
    public int TotalEvents { get; set; }
    public DateTime? LastActivity { get; set; }
    public List<SessionSummaryWithDetails> RecentSessions { get; set; } = new();
    public List<ClaimTypeMetrics> ClaimTypeBreakdown { get; set; } = new();
}

public class SessionSummaryWithDetails
{
    public int SessionId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int ClaimsProcessed { get; set; }
    public double AvgClaimDuration { get; set; }
    public int TotalTimeSeconds { get; set; }
    public int TotalEvents { get; set; }
}
