using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System;
using System.IO;
using System.Threading.Tasks;

namespace Meridian.Infrastructure.Services
{
    public class R2StorageService : IFileStorageService
    {
        private readonly IAmazonS3 _s3Client;
        private readonly string _bucketName;
        private readonly string _publicDomain;

        public R2StorageService(IConfiguration configuration)
        {
            var accessKey = configuration["R2:AccessKey"] ?? throw new ArgumentNullException("R2:AccessKey is missing");
            var secretKey = configuration["R2:SecretKey"] ?? throw new ArgumentNullException("R2:SecretKey is missing");
            var serviceUrl = configuration["R2:ServiceUrl"] ?? throw new ArgumentNullException("R2:ServiceUrl is missing");
            
            _bucketName = configuration["R2:BucketName"] ?? throw new ArgumentNullException("R2:BucketName is missing");
            _publicDomain = configuration["R2:PublicDomain"] ?? throw new ArgumentNullException("R2:PublicDomain is missing");

            var config = new AmazonS3Config
            {
                ServiceURL = serviceUrl,
                ForcePathStyle = true, // Cloudflare R2, path-style URL gerektirir
                AuthenticationRegion = "auto" // R2 region olarak 'auto' kullanır
            };

            _s3Client = new AmazonS3Client(accessKey, secretKey, config);
        }

        public async Task<string> UploadFileAsync(IFormFile file, string folder = "")
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("Dosya boş olamaz.");

            // Benzersiz bir dosya adı oluştur
            var fileExtension = Path.GetExtension(file.FileName);
            var fileName = $"{Guid.NewGuid()}{fileExtension}";
            
            var key = string.IsNullOrEmpty(folder) ? fileName : $"{folder}/{fileName}";

            using var newMemoryStream = new MemoryStream();
            await file.CopyToAsync(newMemoryStream);
            newMemoryStream.Position = 0; // R2'ye yüklemeden önce stream başa sarılmalı

            var putRequest = new PutObjectRequest
            {
                BucketName = _bucketName,
                Key = key,
                InputStream = newMemoryStream,
                ContentType = file.ContentType,
                DisablePayloadSigning = true, // Cloudflare R2 için önerilen ayar
                DisableDefaultChecksumValidation = true // Checksum mismatch hatasını önler
            };

            await _s3Client.PutObjectAsync(putRequest);

            // Cloudflare public URL döndür
            return $"{_publicDomain.TrimEnd('/')}/{key}";
        }

        public async Task<bool> DeleteFileAsync(string fileUrl)
        {
            if (string.IsNullOrEmpty(fileUrl) || !fileUrl.StartsWith(_publicDomain))
                return false;
            
            var key = fileUrl.Substring(_publicDomain.Length).TrimStart('/');

            var deleteRequest = new DeleteObjectRequest
            {
                BucketName = _bucketName,
                Key = key
            };

            var response = await _s3Client.DeleteObjectAsync(deleteRequest);
            return response.HttpStatusCode == System.Net.HttpStatusCode.NoContent || response.HttpStatusCode == System.Net.HttpStatusCode.OK;
        }
    }
}
