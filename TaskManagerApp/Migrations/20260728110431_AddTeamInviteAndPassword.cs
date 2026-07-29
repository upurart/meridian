using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagerApp.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamInviteAndPassword : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InviteCode",
                table: "TeamGroups",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "TeamGroups",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InviteCode",
                table: "TeamGroups");

            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "TeamGroups");
        }
    }
}
