package com.demo.campus.auth.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/** JWT 生成与解析 */
@Component
public class JwtUtil {

    // 签名密钥硬编码在源码里
    private static final String SECRET = "campus-jwt-secret-key-0123456789abcdef";

    private static final long EXPIRE_MS = 24 * 60 * 60 * 1000L; // 24 小时

    private final SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    public String generateToken(Long userId, String role) {
        Date now = new Date();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + EXPIRE_MS))
                .signWith(key)
                .compact();
    }

    /** 校验并解析 token，失败抛出异常 */
    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
