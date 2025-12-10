package com.tripmaster.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;

/**
 * Web配置
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    
    @Value("${app.upload.team-logos-dir:${user.home}/uploads/team_logos}")
    private String teamLogosUploadDir;
    
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 配置团徽图片的静态资源访问（使用配置的路径）
        String uploadDir = teamLogosUploadDir;
        // 确保路径是绝对路径
        File dir = new File(uploadDir);
        if (!dir.isAbsolute()) {
            // 如果是相对路径，转换为绝对路径
            uploadDir = dir.getAbsolutePath();
        }
        // 确保路径以分隔符结尾
        if (!uploadDir.endsWith(File.separator)) {
            uploadDir += File.separator;
        }
        
        // 配置静态资源映射
        // 规范化路径：将反斜杠转换为正斜杠（Windows 路径兼容）
        String normalizedPath = uploadDir.replace("\\", "/");
        // Windows 路径需要 file:/// 前缀（三个斜杠），Unix 路径需要 file:// 前缀
        String resourceLocation;
        if (normalizedPath.matches("^[A-Za-z]:/.*")) {
            // Windows 路径（如 C:/...）
            resourceLocation = "file:///" + normalizedPath;
        } else {
            // Unix/Linux 路径（如 /home/...）
            resourceLocation = "file://" + normalizedPath;
        }
        System.out.println("配置团徽静态资源映射: /images/team_logos/** -> " + resourceLocation);
        System.out.println("实际目录路径: " + uploadDir);
        System.out.println("规范化路径: " + normalizedPath);
        System.out.println("目录是否存在: " + dir.exists());
        
        registry.addResourceHandler("/images/team_logos/**")
                .addResourceLocations(resourceLocation)
                .setCachePeriod(3600); // 缓存1小时
    }
}
