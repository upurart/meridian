using System;
using System.Security.Cryptography;
using System.Text;

namespace Meridian.Helpers
{
    public static class TotpHelper
    {
        private static readonly DateTime UnixEpoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        public static string GenerateSecret()
        {
            byte[] buffer = new byte[20]; // 160-bit secret is the recommended minimum for modern Authenticator apps (32 characters base32)
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(buffer);
            }
            return Base32Encode(buffer);
        }

        public static bool ValidateCode(string secret, string code, int toleranceWindows = 1)
        {
            if (string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(code))
                return false;

            long counter = (long)(DateTime.UtcNow - UnixEpoch).TotalSeconds / 30;
            
            for (int i = -toleranceWindows; i <= toleranceWindows; i++)
            {
                string generated = GenerateCode(secret, counter + i);
                if (generated == code)
                    return true;
            }

            return false;
        }

        private static string GenerateCode(string secret, long counter)
        {
            byte[] key = Base32Decode(secret);
            byte[] msg = BitConverter.GetBytes(counter);
            
            if (BitConverter.IsLittleEndian)
                Array.Reverse(msg);

            using (var hmac = new HMACSHA1(key))
            {
                byte[] hash = hmac.ComputeHash(msg);
                int offset = hash[hash.Length - 1] & 0x0F;
                
                int binary =
                    ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);

                int otp = binary % 1000000;
                return otp.ToString("D6");
            }
        }

        private static string Base32Encode(byte[] data)
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
            var sb = new StringBuilder((data.Length * 8 + 4) / 5);
            int bitIndex = 0;
            while (bitIndex < data.Length * 8)
            {
                int dualbyte = data[bitIndex / 8] << 8;
                if (bitIndex / 8 + 1 < data.Length)
                    dualbyte |= data[bitIndex / 8 + 1];

                dualbyte = 0x1F & (dualbyte >> (16 - bitIndex % 8 - 5));
                sb.Append(chars[dualbyte]);
                bitIndex += 5;
            }
            return sb.ToString();
        }

        private static byte[] Base32Decode(string base32)
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
            base32 = base32.Trim().TrimEnd('=').ToUpper();
            var outArray = new byte[base32.Length * 5 / 8];
            int outIndex = 0;
            int buffer = 0;
            int bitsLeft = 0;
            foreach (char c in base32)
            {
                int cVal = chars.IndexOf(c);
                if (cVal < 0) continue;
                buffer = (buffer << 5) | cVal;
                bitsLeft += 5;
                if (bitsLeft >= 8)
                {
                    outArray[outIndex++] = (byte)(buffer >> (bitsLeft - 8));
                    bitsLeft -= 8;
                }
            }
            return outArray;
        }
    }
}