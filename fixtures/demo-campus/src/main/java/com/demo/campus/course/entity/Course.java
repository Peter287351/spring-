package com.demo.campus.course.entity;

import lombok.Data;

import java.time.LocalDateTime;

/** 课程表 t_course */
@Data
public class Course {

    private Long id;
    private String name;
    private String teacher;
    private String classroom;
    private String schedule;
    private Integer capacity;
    /** 已选人数（冗余计数，随选课/退课增减） */
    private Integer enrolled;
    private LocalDateTime createdAt;
}
