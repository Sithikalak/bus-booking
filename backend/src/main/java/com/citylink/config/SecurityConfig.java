package com.citylink.config;

import com.citylink.security.JwtFilter;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  BCryptPasswordEncoder encoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityFilterChain security(
    HttpSecurity http,
    JwtFilter filter,
    @Value("${app.cors-origin}") String origin
  ) throws Exception {
    var config = new CorsConfiguration();
    config.setAllowedOriginPatterns(
      List.of("http://localhost:*", "http://127.0.0.1:*", origin)
    );
    config.setAllowedMethods(
      List.of("GET", "POST", "PUT", "DELETE", "OPTIONS")
    );
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    var cors = new UrlBasedCorsConfigurationSource();
    cors.registerCorsConfiguration("/**", config);
    return http
      .csrf(c -> c.disable())
      .cors(c -> c.configurationSource(cors))
      .sessionManagement(c ->
        c.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
      )
      .authorizeHttpRequests(a ->
        a
          .requestMatchers(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/verify",
            "/api/auth/resend",
            "/api/auth/recover",
            "/api/auth/reset",
            "/api/health"
          )
          .permitAll()
          .requestMatchers(
            org.springframework.http.HttpMethod.GET,
            "/api/routes",
            "/api/trips",
            "/api/trips/*",
            "/api/trips/*/seats",
            "/api/public/**"
          )
          .permitAll()
          .anyRequest()
          .authenticated()
      )
      .exceptionHandling(e ->
        e
          .authenticationEntryPoint((req, res, ex) -> {
            res.setStatus(401);
            res.setContentType("application/json");
            res
              .getWriter()
              .write(
                "{\"success\":false,\"message\":\"Please sign in to continue.\",\"errorCode\":\"UNAUTHORIZED\"}"
              );
          })
          .accessDeniedHandler((req, res, ex) -> {
            res.setStatus(403);
            res.setContentType("application/json");
            res
              .getWriter()
              .write(
                "{\"success\":false,\"message\":\"Access denied.\",\"errorCode\":\"FORBIDDEN\"}"
              );
          })
      )
      .addFilterBefore(filter, UsernamePasswordAuthenticationFilter.class)
      .build();
  }
}
