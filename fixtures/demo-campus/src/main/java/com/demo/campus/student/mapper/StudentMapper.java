package com.demo.campus.student.mapper;

import com.demo.campus.student.entity.Student;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface StudentMapper {

    @Select("SELECT COUNT(*) FROM t_student")
    long count();

    @Select("SELECT * FROM t_student ORDER BY id LIMIT #{offset}, #{size}")
    List<Student> selectPage(@Param("offset") int offset, @Param("size") int size);

    @Select("SELECT * FROM t_student WHERE name LIKE CONCAT('%', #{keyword}, '%')")
    List<Student> selectByNameLike(@Param("keyword") String keyword);

    @Select("SELECT * FROM t_student WHERE id = #{id}")
    Student selectById(Long id);

    @Select("SELECT * FROM t_student WHERE student_no = #{studentNo}")
    Student selectByStudentNo(String studentNo);

    @Insert("INSERT INTO t_student(student_no, name, class_id, email, phone) " +
            "VALUES(#{studentNo}, #{name}, #{classId}, #{email}, #{phone})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Student student);

    @Update("UPDATE t_student SET name = #{name}, class_id = #{classId}, " +
            "email = #{email}, phone = #{phone} WHERE id = #{id}")
    int update(Student student);

    @Delete("DELETE FROM t_student WHERE id = #{id}")
    int deleteById(Long id);
}
