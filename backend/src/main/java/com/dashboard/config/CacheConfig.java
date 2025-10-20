package com.dashboard.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.time.Duration;

/**
 * Cache configuration optimized for analytics queries
 * Uses Caffeine for high-performance in-memory caching
 */
@Configuration
@EnableCaching
public class CacheConfig {
    
    /**
     * Primary cache manager for SQL query results
     * Optimized for analytics use case with longer TTL
     */
    @Bean
    @Primary
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(caffeineCacheBuilder());
        return cacheManager;
    }
    
    /**
     * Caffeine cache configuration for analytics queries
     */
    @Bean
    public Caffeine<Object, Object> caffeineCacheBuilder() {
        return Caffeine.newBuilder()
                // Cache size limits
                .maximumSize(1000)  // Max 1000 cached queries
                .initialCapacity(50)  // Start with capacity for 50 queries
                
                // Time-based eviction (perfect for analytics)
                .expireAfterWrite(Duration.ofMinutes(30))  // Cache for 30 minutes
                .expireAfterAccess(Duration.ofMinutes(15))  // Evict if not accessed for 15 minutes
                
                // Performance optimizations
                .recordStats()  // Enable cache statistics for monitoring
                .removalListener((key, value, cause) -> {
                    // Log cache evictions for debugging
                    System.out.println("Cache eviction: " + key + " (cause: " + cause + ")");
                });
    }
    
    /**
     * Fast cache for frequently accessed metadata queries
     * Shorter TTL, smaller size for schema/catalog info
     */
    @Bean("metadataCache")
    public CacheManager metadataCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(200)  // Smaller cache for metadata
                .expireAfterWrite(Duration.ofMinutes(10))  // Shorter TTL for metadata
                .expireAfterAccess(Duration.ofMinutes(5))
                .recordStats());
        return cacheManager;
    }
    
    /**
     * Long-term cache for expensive aggregation queries
     * Longer TTL for complex analytics that rarely change
     */
    @Bean("longTermCache")
    public CacheManager longTermCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(100)  // Fewer but larger results
                .expireAfterWrite(Duration.ofHours(2))  // 2-hour TTL for expensive queries
                .expireAfterAccess(Duration.ofMinutes(30))
                .recordStats());
        return cacheManager;
    }
}
