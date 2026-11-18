
package com.greenpulse.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

 @Bean
 PasswordEncoder passwordEncoder() {
  return new BCryptPasswordEncoder();
 }

 @Bean
 SecurityFilterChain security(HttpSecurity http, JwtFilter filter,
                              CorsConfigurationSource cors) throws Exception {

  return http
          .csrf(c -> c.disable())
          .cors(c -> c.configurationSource(cors))
          .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
          .authorizeHttpRequests(a -> a
                  .requestMatchers(
                          "/api/v1/auth/login",
                          "/api/v1/auth/register",
                          "/actuator/health",
                          "/swagger-ui/**",
                          "/v3/api-docs/**"
                  ).permitAll()
                  .anyRequest().authenticated()
          )
          .exceptionHandling(e -> e
                  .authenticationEntryPoint((q, r, x) -> r.sendError(401, "Authentication required"))
                  .accessDeniedHandler((q, r, x) -> r.sendError(403, "Access denied"))
          )
          .addFilterBefore(filter, UsernamePasswordAuthenticationFilter.class)
          .build();
 }

 @Bean
 CorsConfigurationSource cors(@Value("${greenpulse.cors-origin}") String origin) {

  CorsConfiguration c = new CorsConfiguration();

  c.setAllowedOrigins(List.of(origin));
  c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
  c.setAllowedHeaders(List.of("Authorization", "Content-Type"));
  c.setAllowCredentials(true);

  UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
  s.registerCorsConfiguration("/**", c);

  return s;
 }
}
