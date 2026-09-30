package com.demo.campus.auth.interceptor;

import com.demo.campus.auth.util.JwtUtil;
import com.demo.campus.common.result.Result;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** 登录拦截器：校验 Authorization 头里的 Bearer token */
@Component
@RequiredArgsConstructor
public class LoginInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            write401(response, "未登录");
            return false;
        }
        try {
            Claims claims = jwtUtil.parseToken(auth.substring(7));
            request.setAttribute("userId", claims.getSubject());
            request.setAttribute("role", claims.get("role", String.class));
            return true;
        } catch (Exception e) {
            write401(response, "登录已过期，请重新登录");
            return false;
        }
    }

    private void write401(HttpServletResponse response, String message) throws Exception {
        response.setStatus(401);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(Result.error(401, message)));
    }
}
