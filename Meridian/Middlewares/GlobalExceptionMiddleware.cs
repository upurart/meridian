using Microsoft.AspNetCore.Http;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Meridian.Middlewares
{
    public class GlobalExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<GlobalExceptionMiddleware> _logger;

        public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Beklenmeyen bir sunucu hatası oluştu.");
                await HandleExceptionAsync(context, ex);
            }
        }

        private static Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            // Eğer istek API'den geliyorsa (veya JSON bekleniyorsa), JSON dön
            if (context.Request.Path.StartsWithSegments("/api") || 
                (context.Request.Headers["Accept"].ToString().Contains("application/json")))
            {
                context.Response.ContentType = "application/json";
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;

                var result = JsonSerializer.Serialize(new
                {
                    error = "Sunucu tarafında beklenmeyen bir hata oluştu.",
                    details = exception.Message // Production'da detayları gizlemek isteyebilirsiniz
                });

                return context.Response.WriteAsync(result);
            }
            
            // Aksi takdirde (MVC Controller, sayfa yüklemesi vb.) standart MVC hata işleyicisine devretmek için
            // Aslında burada Exception'ı tekrar fırlatabiliriz ki app.UseExceptionHandler("/Home/Error") devreye girsin.
            throw exception;
        }
    }
}
