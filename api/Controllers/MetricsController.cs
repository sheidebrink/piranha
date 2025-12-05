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

    [HttpPost("session/start")]
    public async Task<ActionResult<Session>> StartSession([FromBody] string userId)
    {
        var session = new Session
        {
            UserId = userId,
            StartTime = DateTime.UtcNow
        };

        _context.Sessions.Add(session);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Started session {SessionId} for user {UserId}", session.Id, userId);
        return Ok(session);
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
