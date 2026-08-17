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
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<IFileStorageService, R2StorageService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<Meridian.Application.Interfaces.IChatService, Meridian.Application.Services.ChatService>();

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
builder.Services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Onboarding/Account/Login";
        options.LogoutPath = "/Onboarding/Account/Logout";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CorporateOnly", policy => 
        policy.RequireAssertion(context => 
            context.User.HasClaim(c => c.Type == "OrganizationId" && c.Value != "0")));
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
app.MapHub<Meridian.Hubs.ChatHub>("/chatHub");

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}",
    defaults: new { area = "Personal" })
    .WithStaticAssets();


app.Run();
