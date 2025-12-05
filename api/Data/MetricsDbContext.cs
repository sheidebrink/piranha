using Microsoft.EntityFrameworkCore;
using PiranhaAPI.Models;

namespace PiranhaAPI.Data;

public class MetricsDbContext : DbContext
{
    public MetricsDbContext(DbContextOptions<MetricsDbContext> options) : base(options)
    {
    }

    public DbSet<Session> Sessions { get; set; }
    public DbSet<Claim> Claims { get; set; }
    public DbSet<MetricEvent> Events { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Session>(entity =>
        {
            entity.ToTable("sessions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.StartTime).HasColumnName("start_time").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(e => e.EndTime).HasColumnName("end_time");
            entity.Property(e => e.TotalClaims).HasColumnName("total_claims").HasDefaultValue(0);
        });

        modelBuilder.Entity<Claim>(entity =>
        {
            entity.ToTable("claims");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SessionId).HasColumnName("session_id");
            entity.Property(e => e.ClaimId).HasColumnName("claim_id");
            entity.Property(e => e.ClaimNumber).HasColumnName("claim_number");
            entity.Property(e => e.ClaimType).HasColumnName("claim_type");
            entity.Property(e => e.StartTime).HasColumnName("start_time").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(e => e.EndTime).HasColumnName("end_time");
            entity.Property(e => e.DurationSeconds).HasColumnName("duration_seconds");
        });

        modelBuilder.Entity<MetricEvent>(entity =>
        {
            entity.ToTable("events");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SessionId).HasColumnName("session_id");
            entity.Property(e => e.ClaimId).HasColumnName("claim_id");
            entity.Property(e => e.EventType).HasColumnName("event_type");
            entity.Property(e => e.EventData).HasColumnName("event_data");
            entity.Property(e => e.Timestamp).HasColumnName("timestamp").HasDefaultValueSql("CURRENT_TIMESTAMP");
        });
    }
}
