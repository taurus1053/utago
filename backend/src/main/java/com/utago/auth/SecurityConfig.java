package com.utago.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * NOTE: 이 클래스가 CORS(로컬 5173)까지 함께 관리한다.
 * 기존 com.utago.api.config.WebConfig 의 addCorsMappings 와 겹치니,
 * 중복 헤더/설정 충돌을 막으려면 WebConfig 쪽 CORS 설정은 제거하는 걸 추천.
 * (이전에 겪었던 ConflictingBeanDefinitionException 같은 문제는 아니고
 * CORS 응답 헤더가 두 군데서 세팅되는 정도라 당장 에러는 안 나겠지만 정리하는 게 깔끔함)
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        // 마이페이지(내 곡 목록)는 로그인 필수 — 더 구체적인 규칙이라 아래 permitAll보다 먼저 와야 함.
                        .requestMatchers(HttpMethod.GET, "/api/songs/my").authenticated()
                        // 나머지 곡 조회는 누구나, 곡 등록(POST)은 로그인한 사용자만.
                        .requestMatchers(HttpMethod.GET, "/api/songs/**").permitAll()
                        // 문법 학습 섹션(claude/기획_정리.md 2026-10-08) — 목록/상세 열람은 누구나,
                        // 학습 체크(PATCH /api/grammar/{id}/learned)는 로그인 필요(아래 anyRequest에서 처리).
                        .requestMatchers(HttpMethod.GET, "/api/grammar/**").permitAll()
                        .requestMatchers("/api/health/**").permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
