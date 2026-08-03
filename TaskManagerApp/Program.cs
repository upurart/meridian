global using System.ComponentModel.DataAnnotations;
global using System.ComponentModel.DataAnnotations.Schema;

using TaskManagerApp.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddMemoryCache();
builder.Services.AddHostedService<TaskManagerApp.Services.TrashCleanupService>();
builder.Services.AddTransient<TaskManagerApp.Services.IEmailSender, TaskManagerApp.Services.SmtpEmailSender>();
builder.Services.AddSingleton<TaskManagerApp.Services.IFileStorageService, TaskManagerApp.Services.R2StorageService>();

builder.Services.AddAntiforgery(options => 
{
    options.HeaderName = "RequestVerificationToken";
});

builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.AutoValidateAntiforgeryTokenAttribute());
});
builder.Services.AddSignalR();
builder.Services.AddHttpContextAccessor();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
    });

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // dbContext.Database.EnsureDeleted(); // eğer tabloyu silmek istersen bu satırı aç.

    dbContext.Database.Migrate();

    if (!dbContext.Users.Any())
    {
        var hasher = new PasswordHasher<User>();
        var defaultUser = new User 
        {
            Name = "Uğur",
            Surname = "Güler",
            Username = "upur",
            Email = "ugur.guler@example.com",
            CreatedAt = DateTime.Now
        };
        defaultUser.PasswordHash = hasher.HashPassword(defaultUser, "password123");
        dbContext.Users.Add(defaultUser);

        dbContext.SaveChanges();
    }
    else
    {
        var ugurUser = dbContext.Users.FirstOrDefault(u => u.Username == "upur");
        if (ugurUser != null && ugurUser.PasswordHash == "hashed_password")
        {
            var hasher = new PasswordHasher<User>();
            ugurUser.PasswordHash = hasher.HashPassword(ugurUser, "password123");
            dbContext.SaveChanges();
        }
    }
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapStaticAssets();
app.MapHub<TaskManagerApp.Hubs.CommentHub>("/commentHub");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();


app.Run();
