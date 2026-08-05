using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using Aquora.Application.Interfaces;

namespace Aquora.Infrastructure.Services
{
    public class CacheService : ICacheService
    {
        private readonly ILogger<CacheService> _logger;
        private readonly ConnectionMultiplexer? _redis;
        private readonly IDatabase? _database;
        private readonly bool _isRedisAvailable;

        public CacheService(IConfiguration configuration, ILogger<CacheService> logger)
        {
            _logger = logger;
            try
            {
                var connectionString = configuration.GetConnectionString("RedisConnection") ?? "localhost:6379";
                var options = ConfigurationOptions.Parse(connectionString);
                options.ConnectRetry = 2;
                options.ConnectTimeout = 1000;
                options.AbortOnConnectFail = false;

                _redis = ConnectionMultiplexer.Connect(options);
                _database = _redis.GetDatabase();
                _isRedisAvailable = _redis.IsConnected;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis connection failed. Caching service will run in fallback no-op mode.");
                _isRedisAvailable = false;
            }
        }

        public async Task<T?> GetAsync<T>(string key)
        {
            if (!_isRedisAvailable || _database == null) return default;

            try
            {
                var value = await _database.StringGetAsync(key);
                if (value.IsNullOrEmpty) return default;

                var json = (string?)value;
                if (string.IsNullOrEmpty(json)) return default;

                return JsonSerializer.Deserialize<T>(json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to read key {Key} from Redis", key);
                return default;
            }
        }

        public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
        {
            if (!_isRedisAvailable || _database == null) return;

            try
            {
                var serialized = JsonSerializer.Serialize(value);
                await _database.StringSetAsync(key, serialized, expiry: expiration.HasValue ? expiration.Value : default);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write key {Key} to Redis", key);
            }
        }

        public async Task RemoveAsync(string key)
        {
            if (!_isRedisAvailable || _database == null) return;

            try
            {
                await _database.KeyDeleteAsync(key);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete key {Key} from Redis", key);
            }
        }
    }
}
