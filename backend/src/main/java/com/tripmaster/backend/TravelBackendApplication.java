package com.tripmaster.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
public class TravelBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(TravelBackendApplication.class, args);
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
                        .allowedOrigins("http://localhost:5173", "http://127.0.0.1:5173")
                        .allowCredentials(true);
            }
        };
    }
}
