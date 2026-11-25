using BL;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure;

/// <summary>Maps domain exceptions to RFC 7807 ProblemDetails; Title carries the Hebrew message to the UI.</summary>
public class ErrorHandler(ILogger<ErrorHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        var (status, title) = exception switch
        {
            BusinessRuleException => (StatusCodes.Status400BadRequest, exception.Message),
            NotFoundException or KeyNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            DbUpdateException => (StatusCodes.Status409Conflict, "הפעולה נדחתה על ידי מסד הנתונים (קשר לרשומות אחרות)"),
            _ => (StatusCodes.Status500InternalServerError, "אירעה שגיאה בלתי צפויה"),
        };
        if (status == StatusCodes.Status500InternalServerError) logger.LogError(exception, "Unhandled exception");
        http.Response.StatusCode = status;
        await http.Response.WriteAsJsonAsync(new ProblemDetails { Status = status, Title = title, Instance = http.Request.Path }, ct);
        return true;
    }
}
