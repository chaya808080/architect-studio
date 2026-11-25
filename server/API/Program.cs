using API.Infrastructure;
using BL;
using DAL;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<StudioContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Studio")));
builder.Services.AddScoped<DalManager>();
builder.Services.AddScoped<BLManager>();

builder.Services.AddControllers();
builder.Services.AddExceptionHandler<ErrorHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o => o.SwaggerDoc("v1", new() { Title = "Atelier – Architecture Studio API", Version = "v1" }));

var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Database:CreateAndSeed"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<StudioContext>();
    if (await db.Database.EnsureCreatedAsync()) await DemoSeeder.SeedAsync(db);
}

app.UseExceptionHandler();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseHttpsRedirection();
app.UseCors();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

/// <summary>Exposed for integration tests (WebApplicationFactory).</summary>
public partial class Program;
