package com.demo.campus.course.mapper;

import com.demo.campus.course.entity.Enrollment;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface EnrollmentMapper {

    @Select("SELECT * FROM t_enrollment WHERE course_id = #{courseId} " +
            "AND student_id = #{studentId} AND status = 'ACTIVE'")
    Enrollment selectActive(@Param("courseId") Long courseId, @Param("studentId") Long studentId);

    @Select("SELECT * FROM t_enrollment WHERE student_id = #{studentId} ORDER BY id DESC")
    List<Enrollment> selectByStudent(Long studentId);

    @Insert("INSERT INTO t_enrollment(course_id, student_id, status) " +
            "VALUES(#{courseId}, #{studentId}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Enrollment enrollment);

    @Update("UPDATE t_enrollment SET status = 'DROPPED' " +
            "WHERE course_id = #{courseId} AND student_id = #{studentId}")
    int markDropped(@Param("courseId") Long courseId, @Param("studentId") Long studentId);
}
