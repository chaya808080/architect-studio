using System.Net;
using System.Net.Http.Json;
using API.Infrastructure;
using BL;
using DAL;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Studio.Tests;

/// <summary>Isolated in-memory SQLite database with the real model and the demo seed.</summary>
public sealed class TestDb : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    public StudioContext Db { get; }
    public BLManager BL { get; }

    private TestDb()
    {
        _connection.Open();
        Db = new StudioContext(new DbContextOptionsBuilder<StudioContext>().UseSqlite(_connection).Options);
        Db.Database.EnsureCreated();
        BL = new BLManager(new DalManager(Db));
    }

    public static async Task<TestDb> CreateAsync()
    {
        var t = new TestDb();
        await DemoSeeder.SeedAsync(t.Db);
        t.Db.ChangeTracker.Clear();
        return t;
    }

    public void Dispose() { Db.Dispose(); _connection.Dispose(); }
}

public class RulesTests
{
    private static readonly List<WorkingHours> Hours = Enumerable.Range(0, 5).Select(d => new WorkingHours { DayOfWeek = d, From = "09:00", To = "18:00" }).ToList();

    private static DateOnly NextSunday()
    {
        var d = DateOnly.FromDateTime(DateTime.Today).AddDays(7);
        while (d.DayOfWeek != DayOfWeek.Sunday) d = d.AddDays(1);
        return d;
    }

    [Theory]
    [InlineData("רמת גן", "ירושלים", 100)]
    [InlineData("תל אביב", "הרצליה", 30)]
    [InlineData("חיפה", "מודיעין", 190)]
    [InlineData("גבעתיים", "בני ברק", 15)]
    public void Travel_minutes_match_the_client_implementation(string a, string b, int expected) =>
        Assert.Equal(expected, Geo.TravelMinutes(a, b));

    [Theory]
    [InlineData("050-1234567", true)]
    [InlineData("0501234567", true)]
    [InlineData("12345", false)]
    public void Phone_validation(string phone, bool ok) => Assert.Equal(ok, Rules.IsValidPhone(phone));

    [Fact]
    public void Meeting_rules_detect_hours_overlap_and_travel()
    {
        var sunday = NextSunday();
        var a = new Meeting { Id = 1, Date = sunday, From = "10:00", To = "11:00", City = "תל אביב" };
        Assert.Empty(Rules.MeetingConflicts(a, [], Hours));
        Assert.Contains("מחוץ לשעות העבודה של הסטודיו", Rules.MeetingConflicts(new Meeting { Id = 2, Date = sunday, From = "19:00", To = "20:00", City = "תל אביב" }, [], Hours));
        Assert.StartsWith("חופף", Rules.MeetingConflicts(new Meeting { Id = 2, Date = sunday, From = "10:30", To = "11:30", City = "תל אביב" }, [a], Hours)[0]);
        Assert.Contains("זמן נסיעה", Rules.MeetingConflicts(new Meeting { Id = 2, Date = sunday, From = "11:15", To = "12:00", City = "ירושלים" }, [a], Hours)[0]);
        // back-to-back in the same city is fine once the 15 minute buffer is respected
        Assert.Empty(Rules.MeetingConflicts(new Meeting { Id = 2, Date = sunday, From = "11:15", To = "12:00", City = "תל אביב" }, [a], Hours));
    }
}

public class ServiceTests
{
    [Fact]
    public async Task Lead_cannot_skip_to_planning_without_payment_plan()
    {
        using var t = await TestDb.CreateAsync();
        var lead = (await t.BL.Projects.GetAllAsync()).First(p => p.Stage == "ליד");
        lead.Stage = "תכנון";
        lead.Fee = 30000;
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => t.BL.Projects.UpdateAsync(lead.Id, lead));
        Assert.Contains("לוח התשלומים", ex.Message);
    }

    [Fact]
    public async Task Signing_creates_a_100_percent_plan_atomically()
    {
        using var t = await TestDb.CreateAsync();
        var lead = (await t.BL.Projects.GetAllAsync()).First(p => p.Stage == "ליד");
        var start = DateOnly.FromDateTime(DateTime.Today);
        await t.BL.Projects.SignAsync(new SignRequest(lead.Id, 42000, start, start.AddMonths(6), [new("מקדמה", 40), new("אמצע", 35), new("סיום", 25)]));
        t.Db.ChangeTracker.Clear();

        var p = await t.BL.Projects.GetByIdAsync(lead.Id);
        var plan = (await t.BL.Payments.GetAllAsync()).Where(x => x.ProjectId == lead.Id).ToList();
        Assert.Equal("נחתם", p.Stage);
        Assert.Equal(100, plan.Sum(x => x.Percent));
        Assert.Equal(42000, plan.Sum(x => x.Amount));

        // a bad plan is rejected and nothing changes
        await Assert.ThrowsAsync<BusinessRuleException>(() => t.BL.Projects.SignAsync(new SignRequest(lead.Id, 1, start, start.AddMonths(1), [new("הכול", 90)])));
        t.Db.ChangeTracker.Clear();
        Assert.Equal(42000, (await t.BL.Projects.GetByIdAsync(lead.Id)).Fee);
    }

    [Fact]
    public async Task Payment_plan_cannot_exceed_100_percent()
    {
        using var t = await TestDb.CreateAsync();
        var signed = (await t.BL.Projects.GetAllAsync()).First(p => p.Stage == "תכנון");
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => t.BL.Payments.CreateAsync(new Payment { ProjectId = signed.Id, Label = "תוספת", Percent = 10, Amount = 1, DueDate = DateOnly.FromDateTime(DateTime.Today) }));
        Assert.Contains("100%", ex.Message);
    }

    [Fact]
    public async Task Meeting_service_enforces_travel_time_against_existing_meetings()
    {
        using var t = await TestDb.CreateAsync();
        var existing = (await t.BL.Meetings.GetAllAsync()).First();
        var far = new Meeting { ClientId = existing.ClientId, Type = "סיור באתר", Date = existing.Date, From = existing.To, To = "12:00", City = existing.City == "ירושלים" ? "חיפה" : "ירושלים" };
        await Assert.ThrowsAsync<BusinessRuleException>(() => t.BL.Meetings.CreateAsync(far));
    }

    [Fact]
    public async Task Deleting_a_project_cascades_and_clients_with_projects_are_protected()
    {
        using var t = await TestDb.CreateAsync();
        var signed = (await t.BL.Projects.GetAllAsync()).First(p => p.Stage == "ביצוע");
        await Assert.ThrowsAsync<BusinessRuleException>(() => t.BL.Clients.DeleteAsync(signed.ClientId));
        await t.BL.Projects.DeleteAsync(signed.Id);
        Assert.DoesNotContain(await t.BL.Payments.GetAllAsync(), x => x.ProjectId == signed.Id);
        Assert.DoesNotContain(await t.BL.Tasks.GetAllAsync(), x => x.ProjectId == signed.Id);
    }

    [Fact]
    public async Task Palette_round_trips_through_the_database()
    {
        using var t = await TestDb.CreateAsync();
        var p = (await t.BL.Projects.GetAllAsync()).First();
        p.Palette = ["#112233", "#aabbcc"];
        await t.BL.Projects.UpdateAsync(p.Id, p);
        t.Db.ChangeTracker.Clear();
        Assert.Equal(["#112233", "#aabbcc"], (await t.BL.Projects.GetByIdAsync(p.Id)).Palette);
    }
}

/// <summary>Real ASP.NET Core pipeline over SQLite.</summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(s =>
        {
            s.RemoveAll<DbContextOptions<StudioContext>>();
            s.AddDbContext<StudioContext>(o => o.UseSqlite(_connection));
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        _connection.Open();
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StudioContext>();
        db.Database.EnsureCreated();
        DemoSeeder.SeedAsync(db).GetAwaiter().GetResult();
        return host;
    }

    protected override void Dispose(bool disposing) { base.Dispose(disposing); _connection.Dispose(); }
}

public class ApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _http = factory.CreateClient();

    [Theory]
    [InlineData("/api/clients")] [InlineData("/api/projects")] [InlineData("/api/tasks")] [InlineData("/api/budget-items")]
    [InlineData("/api/payments")] [InlineData("/api/meetings")] [InlineData("/api/working-hours")] [InlineData("/api/inspirations")]
    [InlineData("/api/approvals")] [InlineData("/health")]
    public async Task Endpoints_respond(string url) => Assert.Equal(HttpStatusCode.OK, (await _http.GetAsync(url)).StatusCode);

    [Fact]
    public async Task Invalid_client_returns_hebrew_problem_details()
    {
        var res = await _http.PostAsJsonAsync("/api/clients", new { firstName = "בדיקה", lastName = "בדיקה", phone = "123", email = "a@b.co", city = "תל אביב", source = "גוגל", createdAt = "2026-01-01", notes = "" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("מספר הטלפון אינו תקין", (await res.Content.ReadFromJsonAsync<ProblemDetails>())!.Title);
    }

    [Fact]
    public async Task Sign_endpoint_moves_project_to_signed()
    {
        var projects = await _http.GetFromJsonAsync<List<Project>>("/api/projects");
        var lead = projects!.First(p => p.Stage is "ליד" or "הצעת מחיר");
        var res = await _http.PostAsJsonAsync($"/api/projects/{lead.Id}/sign", new { projectId = lead.Id, fee = 36000, startDate = "2027-01-03", dueDate = "2027-07-01", plan = new[] { new { label = "מקדמה", percent = 50 }, new { label = "סיום", percent = 50 } } });
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal("נחתם", (await _http.GetFromJsonAsync<Project>($"/api/projects/{lead.Id}"))!.Stage);
    }

    [Fact]
    public async Task Missing_entity_is_404() => Assert.Equal(HttpStatusCode.NotFound, (await _http.GetAsync("/api/projects/98765")).StatusCode);
}
