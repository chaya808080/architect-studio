using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace DAL;

/// <summary>Code-first model of the studio. Projects own their tasks, budget, payments and approvals (cascade).</summary>
public class StudioContext(DbContextOptions<StudioContext> options) : DbContext(options)
{
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectTask> Tasks => Set<ProjectTask>();
    public DbSet<BudgetItem> BudgetItems => Set<BudgetItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Meeting> Meetings => Set<Meeting>();
    public DbSet<WorkingHours> WorkingHours => Set<WorkingHours>();
    public DbSet<Inspiration> Inspirations => Set<Inspiration>();
    public DbSet<Approval> Approvals => Set<Approval>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Client>(e =>
        {
            e.Property(x => x.FirstName).HasMaxLength(50).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(50).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.Email).HasMaxLength(120);
            e.Property(x => x.City).HasMaxLength(40);
            e.Property(x => x.Source).HasMaxLength(30);
        });

        b.Entity<Project>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Stage).HasMaxLength(30);
            e.Property(x => x.Budget).HasPrecision(12, 2);
            e.Property(x => x.Fee).HasPrecision(12, 2);
            // palette is a small list of hex colours - stored as one comma-separated column
            e.Property(x => x.Palette)
                .HasConversion(v => string.Join(',', v), v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                    new ValueComparer<List<string>>((a, c) => a!.SequenceEqual(c!), v => v.Aggregate(0, (h, s) => HashCode.Combine(h, s.GetHashCode())), v => v.ToList()))
                .HasMaxLength(200);
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.Stage);
        });

        b.Entity<ProjectTask>(e => e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade));
        b.Entity<BudgetItem>(e =>
        {
            e.Property(x => x.Planned).HasPrecision(12, 2);
            e.Property(x => x.Actual).HasPrecision(12, 2);
            e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<Payment>(e =>
        {
            e.Property(x => x.Percent).HasPrecision(5, 2);
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.DueDate);
        });
        b.Entity<Approval>(e => e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade));
        b.Entity<Meeting>(e =>
        {
            e.Property(x => x.From).HasMaxLength(5);
            e.Property(x => x.To).HasMaxLength(5);
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(x => x.Date);
        });
    }
}
