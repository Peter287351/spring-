package com.demo.campus.student.entity;

import lombok.Data;

/** 班级表 t_class（Klass 避免 class 关键字） */
@Data
public class Klass {

    private Long id;
    private String name;
    private String grade;
    private String headTeacher;
}
