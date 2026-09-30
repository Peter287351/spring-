-- 校园管理系统建表脚本
CREATE DATABASE IF NOT EXISTS campus DEFAULT CHARSET utf8mb4;
USE campus;

CREATE TABLE sys_user (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(100) NOT NULL COMMENT '明文存储',
    real_name   VARCHAR(50)  NOT NULL,
    role        VARCHAR(20)  NOT NULL COMMENT 'ADMIN / STUDENT',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE t_class (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    name         VARCHAR(50) NOT NULL COMMENT '班级名',
    grade        VARCHAR(20) NOT NULL,
    head_teacher VARCHAR(50) NOT NULL
);

CREATE TABLE t_student (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_no VARCHAR(20) NOT NULL UNIQUE,
    name       VARCHAR(50) NOT NULL,
    class_id   BIGINT NOT NULL,
    email      VARCHAR(100),
    phone      VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_class FOREIGN KEY (class_id) REFERENCES t_class (id)
);

CREATE TABLE t_course (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,
    teacher     VARCHAR(50)  NOT NULL,
    classroom   VARCHAR(50),
    schedule    VARCHAR(50)  COMMENT '如：周一 3-4节',
    capacity    INT          NOT NULL COMMENT '容量上限',
    enrolled    INT          NOT NULL DEFAULT 0 COMMENT '已选人数（冗余计数）',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE t_enrollment (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    course_id  BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE / DROPPED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_course_student UNIQUE (course_id, student_id),
    CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES t_course (id),
    CONSTRAINT fk_enr_student FOREIGN KEY (student_id) REFERENCES t_student (id)
);
