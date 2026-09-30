package com.demo.campus.auth.mapper;

import com.demo.campus.auth.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper {

    @Select("SELECT * FROM sys_user WHERE username = #{username}")
    User selectByUsername(String username);
}
