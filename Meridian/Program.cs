global using System.ComponentModel.DataAnnotations;
global using System.ComponentModel.DataAnnotations.Schema;

using Meridian.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddMemoryCache();
builder.Services.AddHostedService<Meridian.Services.TrashCleanupService>();
builder.Services.AddTransient<Meridian.Services.IEmailSender, Meridian.Services.SmtpEmailSender>();
builder.Services.AddSingleton<Meridian.Services.IFileStorageService, Meridian.Services.R2StorageService>();
builder.Services.AddScoped<Meridian.Services.IProjectService, Meridian.Services.ProjectService>();

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

    var defaultOrg = dbContext.Organizations.FirstOrDefault();
    if (defaultOrg == null)
    {
        defaultOrg = new Organization { Name = "Uğur'un Kişisel Organizasyonu", CreatedAt = DateTime.Now };
        dbContext.Organizations.Add(defaultOrg);
        dbContext.SaveChanges();
    }

    // Fix any orphaned records that got OrganizationId = 0 from the migration
    var orphanedUsers = dbContext.Users.Where(u => u.OrganizationId == 0).ToList();
    foreach (var u in orphanedUsers) u.OrganizationId = defaultOrg.Id;

    var orphanedTeams = dbContext.TeamGroups.Where(t => t.OrganizationId == 0).ToList();
    foreach (var t in orphanedTeams) t.OrganizationId = defaultOrg.Id;

    var orphanedWorkspaces = dbContext.Workspaces.Where(w => w.OrganizationId == 0).ToList();
    foreach (var w in orphanedWorkspaces) w.OrganizationId = defaultOrg.Id;

    if (orphanedUsers.Any() || orphanedTeams.Any() || orphanedWorkspaces.Any())
    {
        dbContext.SaveChanges();
    }

    if (!dbContext.Users.Any())
    {
        var hasher = new PasswordHasher<User>();
        var defaultUser = new User 
        {
            Name = "Uğur",
            Surname = "Güler",
            Username = "upur",
            Email = "ugur.guler@example.com",
            CreatedAt = DateTime.Now,
            OrganizationId = defaultOrg.Id
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
app.MapHub<Meridian.Hubs.CommentHub>("/commentHub");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();


app.Run();
