using DAL;
using Microsoft.EntityFrameworkCore;
using static BL.Rules;

namespace BL;

/// <summary>Generic business service: hooks for normalisation, validation and referential checks around the repository.</summary>
public abstract class CrudService<T>(IRepository<T> repository, string entityName) where T : class, IEntity
{
    public Task<List<T>> GetAllAsync() => repository.GetAllAsync();

    public async Task<T> GetByIdAsync(int id) => await repository.GetByIdAsync(id) ?? throw new NotFoundException(entityName, id);

    public async Task<T> CreateAsync(T item)
    {
        Normalize(item, null);
        await ValidateAsync(item, null);
        return await repository.CreateAsync(item);
    }

    public async Task<T> UpdateAsync(int id, T item)
    {
        item.Id = id;
        var previous = await GetByIdAsync(id);
        Normalize(item, previous);
        await ValidateAsync(item, previous);
        await repository.UpdateAsync(item);
        return item;
    }

    public async Task DeleteAsync(int id)
    {
        await BeforeDeleteAsync(id);
        if (!await repository.DeleteAsync(id)) throw new NotFoundException(entityName, id);
    }

    protected virtual void Normalize(T item, T? previous) { }
    protected virtual Task ValidateAsync(T item, T? previous) => Task.CompletedTask;
    protected virtual Task BeforeDeleteAsync(int id) => Task.CompletedTask;
}

public class ClientService(DalManager dal) : CrudService<Client>(dal.Clients, "לקוח")
{
    protected override Task ValidateAsync(Client c, Client? previous)
    {
        Require(!string.IsNullOrWhiteSpace(c.FirstName) && !string.IsNullOrWhiteSpace(c.LastName), "שם פרטי ושם משפחה הם שדות חובה");
        Require(IsValidPhone(c.Phone), "מספר הטלפון אינו תקין");
        Require(IsValidEmail(c.Email), "כתובת המייל אינה תקינה");
        return Task.CompletedTask;
    }

    protected override async Task BeforeDeleteAsync(int id) =>
        Require(!await dal.Db.Projects.AnyAsync(p => p.ClientId == id), "לא ניתן למחוק לקוח שיש לו פרויקטים");
}

public record SignRequest(int ProjectId, decimal Fee, DateOnly StartDate, DateOnly DueDate, List<PlanStep> Plan);
public record PlanStep(string Label, decimal Percent);

public class ProjectService(DalManager dal) : CrudService<Project>(dal.Projects, "פרויקט")
{
    protected override void Normalize(Project p, Project? previous)
    {
        if (previous == null || previous.Stage != p.Stage) p.StageChangedAt = DateOnly.FromDateTime(DateTime.Today);
        if (previous == null && p.CreatedAt == default) p.CreatedAt = DateOnly.FromDateTime(DateTime.Today);
    }

    protected override async Task ValidateAsync(Project p, Project? previous)
    {
        Require(!string.IsNullOrWhiteSpace(p.Name), "שם הפרויקט הוא שדה חובה");
        Require(await dal.Db.Clients.AnyAsync(c => c.Id == p.ClientId), "הלקוח שנבחר אינו קיים");
        Require(p.Area is > 0 and <= 5000, "שטח הנכס חייב להיות בין 1 ל-5,000 מ״ר");
        Require(p.Fee >= 0 && p.Budget >= 0, "סכומים לא יכולים להיות שליליים");
        Require(p.DueDate >= p.StartDate, "תאריך היעד חייב להיות אחרי תאריך ההתחלה");
        if (IsSigned(p.Stage) && p.Stage != "הושלם") Require(p.Fee > 0, "לפרויקט חתום חייב להיות שכר טרחה");
        if (previous != null && previous.Stage != p.Stage)
        {
            var problems = StageProblems(p, p.Stage, await dal.Payments.GetAllAsync(), await dal.Tasks.GetAllAsync());
            Require(problems.Count == 0, problems.FirstOrDefault() ?? "");
        }
    }

    /// <summary>Signs a proposal atomically: fee + dates, stage 'נחתם' and a fresh payment plan.</summary>
    public async Task SignAsync(SignRequest r)
    {
        Require(Math.Round(r.Plan.Sum(x => x.Percent)) == 100, "לוח התשלומים חייב להסתכם ב-100%");
        await using var tx = await dal.Db.Database.BeginTransactionAsync();
        var p = await GetByIdAsync(r.ProjectId);
        var previous = await GetByIdAsync(r.ProjectId);
        p.Fee = r.Fee; p.StartDate = r.StartDate; p.DueDate = r.DueDate; p.Stage = "נחתם";
        Normalize(p, previous);
        await ValidateAsync(p, null);
        await dal.Projects.UpdateAsync(p);

        await dal.Db.Payments.Where(x => x.ProjectId == p.Id).ExecuteDeleteAsync();
        var span = Math.Max(30, r.DueDate.DayNumber - r.StartDate.DayNumber);
        decimal acc = 0;
        foreach (var step in r.Plan)
        {
            dal.Db.Payments.Add(new Payment
            {
                ProjectId = p.Id, Label = step.Label, Percent = step.Percent, Amount = Math.Round(r.Fee * step.Percent / 100),
                DueDate = r.StartDate.AddDays((int)Math.Round(span * acc / 100)),
            });
            acc += step.Percent;
        }
        await dal.Db.SaveChangesAsync();
        await tx.CommitAsync();
    }
}

public class PaymentService(DalManager dal) : CrudService<Payment>(dal.Payments, "תשלום")
{
    protected override async Task ValidateAsync(Payment x, Payment? previous)
    {
        Require(!string.IsNullOrWhiteSpace(x.Label), "יש לתת שם לאבן הדרך");
        Require(x.Percent is > 0 and <= 100, "האחוז חייב להיות בין 1 ל-100");
        // summed in memory: decimal aggregates aren't translatable on every provider (e.g. SQLite)
        var others = (await dal.Db.Payments.Where(o => o.ProjectId == x.ProjectId && o.Id != x.Id).Select(o => o.Percent).ToListAsync()).Sum();
        Require(others + x.Percent <= 100, $"סך אבני הדרך יעבור את 100% ({others + x.Percent:0.##}%)");
    }
}

public class BudgetService(DalManager dal) : CrudService<BudgetItem>(dal.BudgetItems, "סעיף תקציב")
{
    protected override Task ValidateAsync(BudgetItem b, BudgetItem? previous)
    {
        Require(b.Planned >= 0 && b.Actual >= 0, "סכומי התקציב לא יכולים להיות שליליים");
        return Task.CompletedTask;
    }
}

public class MeetingService(DalManager dal) : CrudService<Meeting>(dal.Meetings, "פגישה")
{
    protected override async Task ValidateAsync(Meeting m, Meeting? previous)
    {
        Require(await dal.Db.Clients.AnyAsync(c => c.Id == m.ClientId), "הלקוח שנבחר אינו קיים");
        if (m.Status == "בוטל") return;
        var problems = MeetingConflicts(m, await dal.Db.Meetings.AsNoTracking().Where(o => o.Date == m.Date).ToListAsync(), await dal.WorkingHours.GetAllAsync());
        Require(problems.Count == 0, problems.FirstOrDefault() ?? "");
    }
}

public class TaskService(DalManager dal) : CrudService<ProjectTask>(dal.Tasks, "משימה");
public class WorkingHoursService(DalManager dal) : CrudService<WorkingHours>(dal.WorkingHours, "שעות עבודה");
public class InspirationService(DalManager dal) : CrudService<Inspiration>(dal.Inspirations, "השראה");
public class ApprovalService(DalManager dal) : CrudService<Approval>(dal.Approvals, "אישור");

/// <summary>Facade over all business services, created per request.</summary>
public class BLManager(DalManager dal)
{
    public ClientService Clients { get; } = new(dal);
    public ProjectService Projects { get; } = new(dal);
    public TaskService Tasks { get; } = new(dal);
    public BudgetService BudgetItems { get; } = new(dal);
    public PaymentService Payments { get; } = new(dal);
    public MeetingService Meetings { get; } = new(dal);
    public WorkingHoursService WorkingHours { get; } = new(dal);
    public InspirationService Inspirations { get; } = new(dal);
    public ApprovalService Approvals { get; } = new(dal);
}
