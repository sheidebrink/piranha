using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PiranhaAPI.Data;
using PiranhaAPI.Models;
using System.Text.Json;

namespace PiranhaAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MetricsController : ControllerBase
{
    private readonly MetricsDbContext _context;
    private readonly ILogger<MetricsController> _logger;

    public MetricsController(MetricsDbContext context, ILogger<MetricsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }

    [HttpGet("user/{username}")]
    public async Task<ActionResult<User>> GetUser(string username)
    {
        var normalizedUsername = username.ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == normalizedUsername);
        if (user == null)
            return NotFound();
        
        return Ok(user);
    }

    [HttpGet("users")]
    public async Task<ActionResult<List<User>>> GetAllUsers()
    {
        var users = await _context.Users.OrderBy(u => u.Username).ToListAsync();
        return Ok(users);
    }

    [HttpPut("user/{id}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound();

        user.Email = request.Email;
        user.IsAdmin = request.IsAdmin;

        await _context.SaveChangesAsync();
        _logger.LogInformation("Updated user {UserId}: Email={Email}, IsAdmin={IsAdmin}", id, request.Email, request.IsAdmin);

        return Ok(user);
    }

    [HttpDelete("user/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound();

        // Check if user has any sessions or claims
        var hasData = await _context.Sessions.AnyAsync(s => s.UserId == user.Username) ||
                      await _context.Claims.AnyAsync(c => c.SessionId != null);

        if (hasData)
        {
            // Instead of hard delete, we could soft delete or return an error
            // For now, we'll allow deletion but log a warning
            _logger.LogWarning("Deleting user {UserId} who has associated data", id);
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Deleted user {UserId}: {Username}", id, user.Username);
        return Ok(new { message = "User deleted successfully" });
    }

    [HttpPost("session/start")]
    public async Task<ActionResult<object>> StartSession([FromBody] string username)
    {
        // Normalize username to lowercase for case-insensitive comparison
        var normalizedUsername = username.ToLowerInvariant();
        
        // Find or create user (case-insensitive)
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == normalizedUsername);
        if (user == null)
        {
            user = new User
            {
                Username = normalizedUsername,
                Email = $"{normalizedUsername}@cbcsclaims.com", // Default email pattern
                IsAdmin = false,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Created new user {Username}", normalizedUsername);
        }

        // Update last login
        user.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var session = new Session
        {
            UserId = username,
            StartTime = DateTime.UtcNow
        };

        _context.Sessions.Add(session);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Started session {SessionId} for user {UserId}", session.Id, username);

        return Ok(new { 
            id = session.Id, 
            userId = session.UserId, 
            startTime = session.StartTime,
            userEmail = user.Email,
            isAdmin = user.IsAdmin
        });
    }

    [HttpPost("claim/start")]
    public async Task<ActionResult<Claim>> StartClaim([FromBody] ClaimDetectedRequest request)
    {
        var claim = new Claim
        {
            SessionId = request.SessionId,
            ClaimId = request.ClaimId,
            ClaimNumber = request.ClaimNumber,
            ClaimType = request.InsuranceType switch
            {
                "1" => "liability",
                "2" => "workers_comp",
                _ => "unknown"
            },
            StartTime = DateTime.UtcNow
        };

        _context.Claims.Add(claim);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Started claim {ClaimId} in session {SessionId}", claim.ClaimId, claim.SessionId);
        return Ok(claim);
    }

    [HttpPost("claim/end/{claimId}")]
    public async Task<IActionResult> EndClaim(int claimId)
    {
        var claim = await _context.Claims.FindAsync(claimId);
        if (claim == null)
            return NotFound();

        claim.EndTime = DateTime.UtcNow;
        claim.DurationSeconds = (int)(claim.EndTime.Value - claim.StartTime).TotalSeconds;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Ended claim {ClaimId}, duration: {Duration}s", claimId, claim.DurationSeconds);
        return Ok(claim);
    }

    [HttpPost("event")]
    public async Task<IActionResult> TrackEvent([FromBody] TrackEventRequest request)
    {
        var metricEvent = new MetricEvent
        {
            SessionId = request.SessionId,
            ClaimId = request.ClaimId,
            EventType = request.EventType,
            EventData = JsonSerializer.Serialize(request.EventData),
            Timestamp = DateTime.UtcNow
        };

        _context.Events.Add(metricEvent);
        await _context.SaveChangesAsync();

        return Ok(metricEvent);
    }

    [HttpGet("session/{sessionId}/summary")]
    public async Task<ActionResult<SessionSummary>> GetSessionSummary(int sessionId)
    {
        var summary = await _context.Claims
            .Where(c => c.SessionId == sessionId && c.DurationSeconds.HasValue)
            .GroupBy(c => c.SessionId)
            .Select(g => new SessionSummary
            {
                ClaimsProcessed = g.Count(),
                AvgClaimDuration = g.Average(c => c.DurationSeconds!.Value),
                TotalTimeSeconds = g.Sum(c => c.DurationSeconds!.Value)
            })
            .FirstOrDefaultAsync();

        return Ok(summary ?? new SessionSummary());
    }

    [HttpGet("metrics")]
    public async Task<ActionResult<List<ClaimTypeMetrics>>> GetMetrics()
    {
        var metrics = await _context.Claims
            .Where(c => c.DurationSeconds.HasValue)
            .GroupBy(c => c.ClaimType)
            .Select(g => new ClaimTypeMetrics
            {
                ClaimType = g.Key,
                TotalClaims = g.Count(),
                AvgDuration = g.Average(c => c.DurationSeconds!.Value),
                MinDuration = g.Min(c => c.DurationSeconds!.Value),
                MaxDuration = g.Max(c => c.DurationSeconds!.Value)
            })
            .ToListAsync();

        return Ok(metrics);
    }
}
