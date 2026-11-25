using System.Text.RegularExpressions;
using DAL;

namespace BL;

/// <summary>Business rule violated - returned to the client as HTTP 400 with the Hebrew message.</summary>
public class BusinessRuleException(string message) : Exception(message);

/// <summary>Entity not found - returned as HTTP 404.</summary>
public class NotFoundException(string entity, int id) : Exception($"{entity} {id} לא נמצא/ה");

/// <summary>The studio's business rules - mirrored 1:1 by client/src/domain/rules.ts.</summary>
public static partial class Rules
{
    public static readonly string[] Stages = ["ליד", "פגישת היכרות", "הצעת מחיר", "נחתם", "תכנון", "ביצוע", "הושלם"];

    public static void Require(bool condition, string message)
    {
        if (!condition) throw new BusinessRuleException(message);
    }

    public static bool IsValidPhone(string phone) => PhoneRegex().IsMatch(Regex.Replace(phone ?? "", @"[-\s]", ""));
    public static bool IsValidEmail(string mail) => EmailRegex().IsMatch((mail ?? "").Trim());
    public static bool IsSigned(string stage) => Array.IndexOf(Stages, stage) >= Array.IndexOf(Stages, "נחתם");

    public static int ToMinutes(string hhmm)
    {
        var parts = hhmm.Split(':');
        return int.Parse(parts[0]) * 60 + int.Parse(parts[1]);
    }

    /// <summary>Why a project can't move to the target stage (payment plan must add up, no open tasks on completion).</summary>
    public static List<string> StageProblems(Project p, string to, IReadOnlyCollection<Payment> payments, IReadOnlyCollection<ProjectTask> tasks)
    {
        var problems = new List<string>();
        if (to == "אבוד" || Array.IndexOf(Stages, to) <= Array.IndexOf(Stages, "נחתם")) return problems;
        var plan = payments.Where(x => x.ProjectId == p.Id).Sum(x => x.Percent);
        if (Math.Round(plan) != 100) problems.Add($"לוח התשלומים מסתכם ב-{plan:0.##}% ולא ב-100%");
        if (p.Fee <= 0) problems.Add("לא הוגדר שכר טרחה");
        if (to == "הושלם" && tasks.Any(t => t.ProjectId == p.Id && !t.Done)) problems.Add("יש משימות פתוחות בפרויקט");
        return problems;
    }

    /// <summary>Working hours, overlap and travel time between consecutive meetings in different cities.</summary>
    public static List<string> MeetingConflicts(Meeting m, IReadOnlyCollection<Meeting> meetings, IReadOnlyCollection<WorkingHours> hours)
    {
        var problems = new List<string>();
        int start = ToMinutes(m.From), end = ToMinutes(m.To);
        if (end <= start) return ["שעת הסיום חייבת להיות אחרי שעת ההתחלה"];
        var day = (int)m.Date.DayOfWeek;
        if (!hours.Any(h => h.DayOfWeek == day && ToMinutes(h.From) <= start && ToMinutes(h.To) >= end))
            problems.Add("מחוץ לשעות העבודה של הסטודיו");

        var sameDay = meetings.Where(o => o.Id != m.Id && o.Date == m.Date && o.Status != "בוטל").ToList();
        var overlap = sameDay.FirstOrDefault(o => ToMinutes(o.From) < end && ToMinutes(o.To) > start);
        if (overlap != null) problems.Add($"חופף לפגישה אחרת ({overlap.From}–{overlap.To})");

        var before = sameDay.Where(o => ToMinutes(o.To) <= start).OrderByDescending(o => ToMinutes(o.To)).FirstOrDefault();
        var after = sameDay.Where(o => ToMinutes(o.From) >= end).OrderBy(o => ToMinutes(o.From)).FirstOrDefault();
        if (before != null && start - ToMinutes(before.To) < Geo.TravelMinutes(before.City, m.City))
            problems.Add($"אין מספיק זמן נסיעה מ{before.City} ל{m.City} (נדרשות {Geo.TravelMinutes(before.City, m.City)} דק׳)");
        if (after != null && ToMinutes(after.From) - end < Geo.TravelMinutes(m.City, after.City))
            problems.Add($"אין מספיק זמן נסיעה מ{m.City} ל{after.City} (נדרשות {Geo.TravelMinutes(m.City, after.City)} דק׳)");
        return problems;
    }

    [GeneratedRegex(@"^0\d{8,9}$")] private static partial Regex PhoneRegex();
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")] private static partial Regex EmailRegex();
}

/// <summary>Haversine distance between known cities -> driving minutes (same formula as client/src/domain/geo.ts).</summary>
public static class Geo
{
    private static readonly Dictionary<string, (double Lat, double Lon)> Cities = new()
    {
        ["תל אביב"] = (32.0853, 34.7818), ["רמת גן"] = (32.0684, 34.8248), ["בני ברק"] = (32.0807, 34.8338),
        ["גבעתיים"] = (32.0718, 34.8107), ["פתח תקווה"] = (32.0840, 34.8878), ["הרצליה"] = (32.1624, 34.8447),
        ["רעננה"] = (32.1848, 34.8713), ["ראשון לציון"] = (31.9730, 34.7925), ["מודיעין"] = (31.8980, 35.0104),
        ["ירושלים"] = (31.7683, 35.2137), ["חיפה"] = (32.7940, 34.9896), ["כפר סבא"] = (32.1782, 34.9076),
    };

    public static double DistanceKm(string a, string b)
    {
        if (!Cities.TryGetValue(a, out var p) || !Cities.TryGetValue(b, out var q)) return 20;
        const double rad = Math.PI / 180;
        var dLat = (q.Lat - p.Lat) * rad;
        var dLon = (q.Lon - p.Lon) * rad;
        var h = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(p.Lat * rad) * Math.Cos(q.Lat * rad) * Math.Pow(Math.Sin(dLon / 2), 2);
        return 6371 * 2 * Math.Asin(Math.Sqrt(h));
    }

    /// <summary>Same city: 15 min. Otherwise road factor 1.35 at ~45 km/h + 10 min parking, rounded to 5.</summary>
    public static int TravelMinutes(string from, string to)
    {
        if (from == to) return 15;
        var minutes = DistanceKm(from, to) * 1.35 / 45 * 60 + 10;
        return (int)(Math.Round(minutes / 5, MidpointRounding.AwayFromZero) * 5);
    }
}
