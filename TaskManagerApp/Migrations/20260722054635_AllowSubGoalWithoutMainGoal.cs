using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagerApp.Migrations
{
    /// <inheritdoc />
    public partial class AllowSubGoalWithoutMainGoal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "MainGoalId",
                table: "SubGoals",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "SubGoals",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SubGoals_ProjectId",
                table: "SubGoals",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_SubGoals_Projects_ProjectId",
                table: "SubGoals",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SubGoals_Projects_ProjectId",
                table: "SubGoals");

            migrationBuilder.DropIndex(
                name: "IX_SubGoals_ProjectId",
                table: "SubGoals");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "SubGoals");

            migrationBuilder.AlterColumn<int>(
                name: "MainGoalId",
                table: "SubGoals",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
