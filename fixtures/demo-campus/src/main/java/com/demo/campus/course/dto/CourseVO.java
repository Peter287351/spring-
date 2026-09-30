package com.demo.campus.course.dto;

import lombok.Data;

/** 课程视图对象：补一个选课人数百分比，前端展示用 */
@Data
public class CourseVO {
    private Long id;
    private String name;
    private String teacher;
    private String classroom;
    private String schedule;
    private Integer capacity;
    private Integer enrolled;
    /** 已选百分比，enrolled * 100 / capacity */
    private Integer enrolledPercent;
    private String status; // 我的课表里：ACTIVE / DROPPED，课程列表里为 null
}
