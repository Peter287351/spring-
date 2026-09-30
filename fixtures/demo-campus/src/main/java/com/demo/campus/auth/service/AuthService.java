package com.demo.campus.auth.service;

import com.demo.campus.auth.dto.LoginRequest;
import com.demo.campus.auth.dto.LoginResponse;
import com.demo.campus.auth.entity.User;
import com.demo.campus.auth.mapper.UserMapper;
import com.demo.campus.auth.util.JwtUtil;
import com.demo.campus.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** 登录认证逻辑 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest request) {
        User user = userMapper.selectByUsername(request.getUsername());
        if (user == null) {
            throw new BusinessException("用户名或密码错误");
        }
        // 直接明文比对数据库中存储的密码
        if (!user.getPassword().equals(request.getPassword())) {
            throw new BusinessException("用户名或密码错误");
        }
        String token = jwtUtil.generateToken(user.getId(), user.getRole());
        return new LoginResponse(token, user.getRealName(), user.getRole());
    }
}
