namespace DAL;

/// <summary>Every entity has an int Id - lets one generic repository serve all tables.</summary>
public interface IEntity
{
    int Id { get; set; }
}

public class Client : IEntity
{
    public int Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string City { get; set; } = "";
    public string Source { get; set; } = "";
    public DateOnly CreatedAt { get; set; }
    public string Notes { get; set; } = "";
}

public class Project : IEntity
{
    public int Id { get; set; }
    public int ClientId { get; set; }
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string Stage { get; set; } = "ליד";
    public string Style { get; set; } = "";
    public string City { get; set; } = "";
    public int Area { get; set; }
    public decimal Budget { get; set; }
    public decimal Fee { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly DueDate { get; set; }
    public DateOnly CreatedAt { get; set; }
    public DateOnly StageChangedAt { get; set; }
    public List<string> Palette { get; set; } = [];
    public string Notes { get; set; } = "";
}

public class ProjectTask : IEntity
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Phase { get; set; } = "";
    public string Title { get; set; } = "";
    public DateOnly DueDate { get; set; }
    public bool Done { get; set; }
}

public class BudgetItem : IEntity
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Category { get; set; } = "";
    public decimal Planned { get; set; }
    public decimal Actual { get; set; }
}

public class Payment : IEntity
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Label { get; set; } = "";
    public decimal Percent { get; set; }
    public decimal Amount { get; set; }
    public DateOnly DueDate { get; set; }
    public DateOnly? PaidDate { get; set; }
}

public class Meeting : IEntity
{
    public int Id { get; set; }
    public int ClientId { get; set; }
    public int? ProjectId { get; set; }
    public string Type { get; set; } = "";
    public DateOnly Date { get; set; }
    public string From { get; set; } = "";   // HH:mm
    public string To { get; set; } = "";
    public string City { get; set; } = "";
    public string Status { get; set; } = "מתוכנן";
    public string Notes { get; set; } = "";
}

public class WorkingHours : IEntity
{
    public int Id { get; set; }
    public int DayOfWeek { get; set; }
    public string From { get; set; } = "";
    public string To { get; set; } = "";
}

public class Inspiration : IEntity
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Style { get; set; } = "";
    public string Room { get; set; } = "";
    public string Image { get; set; } = "";
    public int Likes { get; set; }
}

public class Approval : IEntity
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Title { get; set; } = "";
    public int Version { get; set; }
    public string Status { get; set; } = "ממתין לאישור";
    public string Comment { get; set; } = "";
    public DateOnly Date { get; set; }
}
