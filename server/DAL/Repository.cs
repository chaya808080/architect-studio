using Microsoft.EntityFrameworkCore;

namespace DAL;

public interface IRepository<T> where T : class, IEntity
{
    Task<List<T>> GetAllAsync();
    Task<T?> GetByIdAsync(int id);
    Task<T> CreateAsync(T item);
    Task UpdateAsync(T item);
    Task<bool> DeleteAsync(int id);
}

/// <summary>Generic async EF Core repository - one implementation for all nine tables.</summary>
public class Repository<T>(StudioContext db) : IRepository<T> where T : class, IEntity
{
    public Task<List<T>> GetAllAsync() => db.Set<T>().AsNoTracking().OrderBy(e => e.Id).ToListAsync();

    public Task<T?> GetByIdAsync(int id) => db.Set<T>().AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);

    public async Task<T> CreateAsync(T item)
    {
        item.Id = 0;
        db.Set<T>().Add(item);
        await db.SaveChangesAsync();
        db.Entry(item).State = EntityState.Detached;
        return item;
    }

    public async Task UpdateAsync(T item)
    {
        var existing = await db.Set<T>().FindAsync(item.Id) ?? throw new KeyNotFoundException($"{typeof(T).Name} {item.Id}");
        db.Entry(existing).CurrentValues.SetValues(item);
        await db.SaveChangesAsync();
        db.Entry(existing).State = EntityState.Detached;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var existing = await db.Set<T>().FindAsync(id);
        if (existing == null) return false;
        db.Set<T>().Remove(existing);
        await db.SaveChangesAsync();
        return true;
    }
}

/// <summary>Unit of work: all repositories share the request's DbContext.</summary>
public class DalManager(StudioContext db)
{
    public StudioContext Db { get; } = db;
    public IRepository<Client> Clients { get; } = new Repository<Client>(db);
    public IRepository<Project> Projects { get; } = new Repository<Project>(db);
    public IRepository<ProjectTask> Tasks { get; } = new Repository<ProjectTask>(db);
    public IRepository<BudgetItem> BudgetItems { get; } = new Repository<BudgetItem>(db);
    public IRepository<Payment> Payments { get; } = new Repository<Payment>(db);
    public IRepository<Meeting> Meetings { get; } = new Repository<Meeting>(db);
    public IRepository<WorkingHours> WorkingHours { get; } = new Repository<WorkingHours>(db);
    public IRepository<Inspiration> Inspirations { get; } = new Repository<Inspiration>(db);
    public IRepository<Approval> Approvals { get; } = new Repository<Approval>(db);
}
