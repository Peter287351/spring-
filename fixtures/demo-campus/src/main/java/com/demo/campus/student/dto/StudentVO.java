package com.demo.campus.student.dto;

import lombok.Data;

/** 学生视图对象：比实体多一个班级名 */
@Data
public class StudentVO {
    private Long id;
    private String studentNo;
    private String name;
    private String className;
    private String email;
    private String phone;
}
