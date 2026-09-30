package com.demo.campus.student.mapper;

import com.demo.campus.student.entity.Klass;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ClassMapper {

    @Select("SELECT * FROM t_class WHERE id = #{id}")
    Klass selectById(Long id);
}
