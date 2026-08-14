using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace Meridian.Application.Interfaces
{
    public interface IFileStorageService
    {
        /// <summary>
        /// Uploads a file to the cloud storage and returns the public URL.
        /// </summary>
        /// <param name="file">The uploaded file</param>
        /// <param name="folder">Optional folder name (e.g., 'avatars' or 'tasks')</param>
        /// <returns>Publicly accessible URL of the uploaded file</returns>
        Task<string> UploadFileAsync(IFormFile file, string folder = "");

        /// <summary>
        /// Deletes a file from the cloud storage.
        /// </summary>
        /// <param name="fileUrl">The full URL of the file to delete</param>
        Task<bool> DeleteFileAsync(string fileUrl);

        /// <summary>
        /// Gets a file stream directly from the cloud storage.
        /// </summary>
        Task<System.IO.Stream> GetFileStreamAsync(string fileUrl);
    }
}
