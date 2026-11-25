using DAL;

namespace API.Infrastructure;

/// <summary>Small invented data set for development (the client's demo mode has a richer generator).</summary>
public static class DemoSeeder
{
    public static async Task SeedAsync(StudioContext db)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        for (var d = 0; d <= 4; d++) db.WorkingHours.Add(new WorkingHours { DayOfWeek = d, From = "09:00", To = "18:00" });
        db.WorkingHours.Add(new WorkingHours { DayOfWeek = 5, From = "09:00", To = "13:00" });

        var clients = new[]
        {
            ("מיכל", "כהן", "תל אביב", "המלצה"), ("דניאל", "לוי", "רמת גן", "אינסטגרם"), ("נועה", "מזרחי", "הרצליה", "גוגל"),
            ("יוסי", "פרץ", "ירושלים", "אתר הסטודיו"), ("שירה", "גולן", "מודיעין", "המלצה"),
        }.Select((c, i) => new Client
        {
            FirstName = c.Item1, LastName = c.Item2, City = c.Item3, Source = c.Item4, Phone = $"05{i}-{1234567 + i}",
            Email = $"client{i + 1}@demo.co.il", CreatedAt = today.AddDays(-30 * (i + 1)),
        }).ToList();
        db.Clients.AddRange(clients);
        await db.SaveChangesAsync();

        var stages = new[] { "ליד", "הצעת מחיר", "תכנון", "ביצוע", "הושלם" };
        var projects = clients.Select((c, i) => new Project
        {
            ClientId = c.Id, Name = $"דירה {c.LastName} – {c.City}", Type = i == 3 ? "בית פרטי" : "דירה", Stage = stages[i], Style = "מודרני",
            City = c.City, Area = 90 + i * 30, Budget = 400000 + i * 150000, Fee = i >= 2 ? 30000 + i * 8000 : 0,
            StartDate = today.AddDays(-60 * i), DueDate = today.AddDays(180 - 40 * i), CreatedAt = c.CreatedAt, StageChangedAt = today.AddDays(-7),
            Palette = ["#f2f1ee", "#c9c6c0", "#5b5a57", "#1f1f1f", "#b08d57"],
        }).ToList();
        db.Projects.AddRange(projects);
        await db.SaveChangesAsync();

        foreach (var p in projects.Where(p => p.Fee > 0))
        {
            var plan = new[] { ("מקדמה בחתימה", 30m), ("אישור תוכנית העמדה", 30m), ("מסירת תיק עיצוב והדמיות", 25m), ("סיום פיקוח ומסירה", 15m) };
            var due = p.StartDate;
            foreach (var (label, pct) in plan)
            {
                db.Payments.Add(new Payment { ProjectId = p.Id, Label = label, Percent = pct, Amount = p.Fee * pct / 100, DueDate = due, PaidDate = due < today ? due : null });
                due = due.AddDays(45);
            }
            foreach (var (phase, k) in new[] { ("מדידות", 0), ("תכנון", 1), ("עיצוב והדמיות", 2), ("ביצוע ופיקוח", 3) })
                db.Tasks.Add(new ProjectTask { ProjectId = p.Id, Phase = phase, Title = $"שלב {phase}", DueDate = p.StartDate.AddDays(30 * (k + 1)), Done = p.Stage == "הושלם" || k == 0 });
            db.BudgetItems.Add(new BudgetItem { ProjectId = p.Id, Category = "מטבח", Planned = 45000, Actual = p.Stage == "תכנון" ? 0 : 47000 });
            db.Approvals.Add(new Approval { ProjectId = p.Id, Title = "תוכנית העמדה", Version = 1, Status = "אושר", Date = today.AddDays(-10) });
        }

        var next = today.AddDays(1);
        while (next.DayOfWeek is DayOfWeek.Friday or DayOfWeek.Saturday) next = next.AddDays(1);
        db.Meetings.Add(new Meeting { ClientId = clients[0].Id, ProjectId = projects[0].Id, Type = "פגישת היכרות", Date = next, From = "10:00", To = "11:00", City = clients[0].City });
        db.Meetings.Add(new Meeting { ClientId = clients[2].Id, ProjectId = projects[2].Id, Type = "פגישת תכנון", Date = next, From = "13:00", To = "14:00", City = clients[2].City });
        db.Inspirations.AddRange(
            new Inspiration { Title = "סלון בגווני אפור", Style = "מודרני", Room = "סלון", Image = "living-gray", Likes = 42 },
            new Inspiration { Title = "מטבח לבן עם אי", Style = "מודרני", Room = "מטבח", Image = "kitchen-white", Likes = 31 },
            new Inspiration { Title = "פינת אוכל ירוקה", Style = "ים תיכוני", Room = "פינת אוכל", Image = "dining-green", Likes = 27 });
        await db.SaveChangesAsync();
    }
}
