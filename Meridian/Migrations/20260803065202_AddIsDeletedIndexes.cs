using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Meridian.Migrations
{
    /// <inheritdoc />
    public partial class AddIsDeletedIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_IsDeleted",
                table: "Workspaces",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_IsDeleted",
                table: "TaskItems",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_SubGoals_IsDeleted",
                table: "SubGoals",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_IsDeleted",
                table: "Projects",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_MainGoals_IsDeleted",
                table: "MainGoals",
                column: "IsDeleted");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Workspaces_IsDeleted",
                table: "Workspaces");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_IsDeleted",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_SubGoals_IsDeleted",
                table: "SubGoals");

            migrationBuilder.DropIndex(
                name: "IX_Projects_IsDeleted",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_MainGoals_IsDeleted",
                table: "MainGoals");
        }
    }
}
