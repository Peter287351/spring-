package com.demo.campus.student.entity;

import lombok.Data;

import java.time.LocalDateTime;

/** 学生表 t_student */
@Data
public class Student {

    private Long id;
    private String studentNo;
    private String name;
    private Long classId;
    private String email;
    private String phone;
    private LocalDateTime createdAt;
}
