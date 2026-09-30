package com.demo.campus.course.entity;

import lombok.Data;

import java.time.LocalDateTime;

/** 选课记录表 t_enrollment */
@Data
public class Enrollment {

    private Long id;
    private Long courseId;
    private Long studentId;
    /** ACTIVE 在读 / DROPPED 已退 */
    private String status;
    private LocalDateTime createdAt;
}
