package com.demo.campus.auth.controller;

import com.demo.campus.auth.dto.LoginRequest;
import com.demo.campus.auth.dto.LoginResponse;
import com.demo.campus.auth.service.AuthService;
import com.demo.campus.common.result.Result;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** 认证入口：登录、获取当前用户 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** 账号密码登录，成功返回 JWT */
    @PostMapping("/login")
    public Result<LoginResponse> login(@RequestBody LoginRequest request) {
        return Result.ok(authService.login(request));
    }

    /** 返回当前登录用户信息（userId 由拦截器写入 request 属性） */
    @GetMapping("/me")
    public Result<Long> me(HttpServletRequest request) {
        Object userId = request.getAttribute("userId");
        return Result.ok(userId == null ? null : Long.valueOf(userId.toString()));
    }
}
