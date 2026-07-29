using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagerApp.Migrations
{
    /// <inheritdoc />
    public partial class AddReplyAndForwardToComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsForwarded",
                table: "Comments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ReplyToId",
                table: "Comments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Comments_ReplyToId",
                table: "Comments",
                column: "ReplyToId");

            migrationBuilder.AddForeignKey(
                name: "FK_Comments_Comments_ReplyToId",
                table: "Comments",
                column: "ReplyToId",
                principalTable: "Comments",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Comments_Comments_ReplyToId",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Comments_ReplyToId",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "IsForwarded",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "ReplyToId",
                table: "Comments");
        }
    }
}
