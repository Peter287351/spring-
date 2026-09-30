package com.demo.campus.auth.entity;

import lombok.Data;

import java.time.LocalDateTime;

/** 系统用户表 sys_user */
@Data
public class User {

    private Long id;
    private String username;
    private String password;    // 数据库中明文存储
    private String realName;
    private String role;        // ADMIN / STUDENT
    private LocalDateTime createdAt;
}
