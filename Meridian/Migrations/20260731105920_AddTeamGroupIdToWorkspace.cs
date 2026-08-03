using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Meridian.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamGroupIdToWorkspace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TeamGroupId",
                table: "Workspaces",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_TeamGroupId",
                table: "Workspaces",
                column: "TeamGroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_Workspaces_TeamGroups_TeamGroupId",
                table: "Workspaces",
                column: "TeamGroupId",
                principalTable: "TeamGroups",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Workspaces_TeamGroups_TeamGroupId",
                table: "Workspaces");

            migrationBuilder.DropIndex(
                name: "IX_Workspaces_TeamGroupId",
                table: "Workspaces");

            migrationBuilder.DropColumn(
                name: "TeamGroupId",
                table: "Workspaces");
        }
    }
}
