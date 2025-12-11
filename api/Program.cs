using Microsoft.EntityFrameworkCore;
using PiranhaAPI.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add SQLite database
builder.Services.AddDbContext<MetricsDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") 
        ?? "Data Source=piranha_metrics.db"));

// Add CORS for Electron app
builder.Services.AddCors(options =>
{
    options.AddPolicy("ElectronApp", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Create database if it doesn't exist and seed data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MetricsDbContext>();
    db.Database.EnsureCreated();
    
    // Seed admin user if not exists
    if (!db.Users.Any(u => u.Username == "sheidebr"))
    {
        db.Users.Add(new PiranhaAPI.Models.User
        {
            Username = "sheidebr",
            Email = "mhuss@cbcsclaims.com",
            IsAdmin = true,
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
        Console.WriteLine("Seeded admin user: sheidebr");
    }
    
    // Migrate existing sessions to use proper foreign keys
    await MigrateSessionsAsync(db);
}

async Task MigrateSessionsAsync(MetricsDbContext context)
{
    try
    {
        // Check if username column exists in sessions table
        var hasUsernameColumn = false;
        try 
        {
            await context.Database.ExecuteSqlRawAsync("SELECT username FROM sessions LIMIT 1");
            hasUsernameColumn = true;
        }
        catch 
        {
            // Column doesn't exist, add it
            await context.Database.ExecuteSqlRawAsync("ALTER TABLE sessions ADD COLUMN username TEXT");
            Console.WriteLine("Added username column to sessions table");
        }
        
        // Get sessions that need migration (where user_id is not a valid integer or doesn't match a user ID)
        var sessions = await context.Sessions.ToListAsync();
        var users = await context.Users.ToListAsync();
        
        foreach (var session in sessions)
        {
            // Try to parse user_id as integer
            if (int.TryParse(session.UserId.ToString(), out int userId))
            {
                // Check if this user ID exists
                var user = users.FirstOrDefault(u => u.Id == userId);
                if (user != null)
                {
                    // Already migrated, just ensure username is set
                    if (string.IsNullOrEmpty(session.Username))
                    {
                        session.Username = user.Username;
                        Console.WriteLine($"Updated username for session {session.Id}");
                    }
                    continue;
                }
            }
            
            // Try to find user by username (assuming user_id contains username)
            var userByName = users.FirstOrDefault(u => 
                string.Equals(u.Username, session.UserId.ToString(), StringComparison.OrdinalIgnoreCase));
            
            if (userByName != null)
            {
                // Update session to use proper foreign key
                await context.Database.ExecuteSqlRawAsync(
                    "UPDATE sessions SET user_id = {0}, username = {1} WHERE id = {2}",
                    userByName.Id, userByName.Username, session.Id);
                
                Console.WriteLine($"Migrated session {session.Id}: '{session.UserId}' -> User ID {userByName.Id}");
            }
            else
            {
                Console.WriteLine($"Warning: Could not find user for session {session.Id} with user_id '{session.UserId}'");
            }
        }
        
        Console.WriteLine("Session migration completed");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Migration error: {ex.Message}");
    }
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ElectronApp");
app.MapControllers();

app.Run();
