using BL;
using DAL;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>GET (list / by id), POST, PUT and DELETE for every resource. Errors become ProblemDetails in ErrorHandler.</summary>
[ApiController]
[Produces("application/json")]
public abstract class CrudController<T>(CrudService<T> service) : ControllerBase where T : class, IEntity
{
    [HttpGet] public Task<List<T>> GetAll() => service.GetAllAsync();

    [HttpGet("{id:int}")] public Task<T> Get(int id) => service.GetByIdAsync(id);

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<T>> Create(T item) => StatusCode(StatusCodes.Status201Created, await service.CreateAsync(item));

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<T> Update(int id, T item) => service.UpdateAsync(id, item);

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await service.DeleteAsync(id);
        return NoContent();
    }
}

[Route("api/clients")] public class ClientsController(BLManager bl) : CrudController<Client>(bl.Clients);
[Route("api/tasks")] public class TasksController(BLManager bl) : CrudController<ProjectTask>(bl.Tasks);
[Route("api/budget-items")] public class BudgetItemsController(BLManager bl) : CrudController<BudgetItem>(bl.BudgetItems);
[Route("api/payments")] public class PaymentsController(BLManager bl) : CrudController<Payment>(bl.Payments);
[Route("api/meetings")] public class MeetingsController(BLManager bl) : CrudController<Meeting>(bl.Meetings);
[Route("api/working-hours")] public class WorkingHoursController(BLManager bl) : CrudController<WorkingHours>(bl.WorkingHours);
[Route("api/inspirations")] public class InspirationsController(BLManager bl) : CrudController<Inspiration>(bl.Inspirations);
[Route("api/approvals")] public class ApprovalsController(BLManager bl) : CrudController<Approval>(bl.Approvals);

[Route("api/projects")]
public class ProjectsController(BLManager bl) : CrudController<Project>(bl.Projects)
{
    /// <summary>Signs a proposal: fee, dates, stage 'נחתם' and the payment plan - in one transaction.</summary>
    [HttpPost("{id:int}/sign")]
    public async Task<IActionResult> Sign(int id, SignRequest request)
    {
        await bl.Projects.SignAsync(request with { ProjectId = id });
        return NoContent();
    }
}
