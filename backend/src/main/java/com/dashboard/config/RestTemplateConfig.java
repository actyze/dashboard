package com.dashboard.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.time.Duration;

/**
 * Configuration for RestTemplate beans used for HTTP service calls
 * Uses Spring Boot 3.4.x compatible approach
 */
@Configuration
public class RestTemplateConfig {
    
    /**
     * RestTemplate for FAISS and ML service calls
     * Configures timeouts using SimpleClientHttpRequestFactory
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .requestFactory(() -> {
                    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                    factory.setConnectTimeout(Duration.ofSeconds(10));
                    factory.setReadTimeout(Duration.ofSeconds(120));
                    return factory;
                })
                .build();
    }
}
