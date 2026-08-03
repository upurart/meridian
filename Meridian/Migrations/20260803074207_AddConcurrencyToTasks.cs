using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Meridian.Migrations
{
    /// <inheritdoc />
    public partial class AddConcurrencyToTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "TaskItems",
                type: "rowversion",
                rowVersion: true,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "TaskItems");
        }
    }
}
