package com.demo.campus.course.mapper;

import com.demo.campus.course.entity.Course;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface CourseMapper {

    @Select("SELECT COUNT(*) FROM t_course")
    long count();

    @Select("SELECT * FROM t_course ORDER BY id LIMIT #{offset}, #{size}")
    List<Course> selectPage(@Param("offset") int offset, @Param("size") int size);

    @Select("SELECT * FROM t_course WHERE id = #{id}")
    Course selectById(Long id);

    @Insert("INSERT INTO t_course(name, teacher, classroom, schedule, capacity, enrolled) " +
            "VALUES(#{name}, #{teacher}, #{classroom}, #{schedule}, #{capacity}, #{enrolled})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Course course);

    /** 冗余计数加减：delta 为 +1 或 -1 */
    @Update("UPDATE t_course SET enrolled = enrolled + #{delta} WHERE id = #{id}")
    int changeEnrolled(@Param("id") Long id, @Param("delta") int delta);
}
