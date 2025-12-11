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
