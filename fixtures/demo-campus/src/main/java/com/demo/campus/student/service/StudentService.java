package com.demo.campus.student.service;

import com.demo.campus.common.exception.BusinessException;
import com.demo.campus.student.dto.PageResult;
import com.demo.campus.student.dto.StudentVO;
import com.demo.campus.student.entity.Klass;
import com.demo.campus.student.entity.Student;
import com.demo.campus.student.mapper.ClassMapper;
import com.demo.campus.student.mapper.StudentMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** 学籍业务逻辑 */
@Service
@RequiredArgsConstructor
public class StudentService {

    private final StudentMapper studentMapper;
    private final ClassMapper classMapper;

    public PageResult<StudentVO> listStudents(int page, int size) {
        long total = studentMapper.count();
        List<Student> students = studentMapper.selectPage((page - 1) * size, size);
        List<StudentVO> voList = new ArrayList<>();
        for (Student s : students) {
            // 每一行都单独查一次班级，存在 N+1 查询
            Klass klass = classMapper.selectById(s.getClassId());
            voList.add(toVO(s, klass));
        }
        return new PageResult<>(total, voList);
    }

    public List<StudentVO> searchByName(String keyword) {
        List<Student> students = studentMapper.selectByNameLike(keyword);
        List<StudentVO> voList = new ArrayList<>();
        for (Student s : students) {
            Klass klass = classMapper.selectById(s.getClassId());
            voList.add(toVO(s, klass));
        }
        return voList;
    }

    public StudentVO getStudent(Long id) {
        Student student = studentMapper.selectById(id);
        if (student == null) {
            throw new BusinessException("学生不存在");
        }
        return toVO(student, classMapper.selectById(student.getClassId()));
    }

    public Long addStudent(Student student) {
        // 先查学号是否重复，再插入
        Student exist = studentMapper.selectByStudentNo(student.getStudentNo());
        if (exist != null) {
            throw new BusinessException("学号已存在");
        }
        studentMapper.insert(student);
        return student.getId();
    }

    public void updateStudent(Student student) {
        studentMapper.update(student);
    }

    public void removeStudent(Long id) {
        studentMapper.deleteById(id);
    }

    private StudentVO toVO(Student s, Klass klass) {
        StudentVO vo = new StudentVO();
        vo.setId(s.getId());
        vo.setStudentNo(s.getStudentNo());
        vo.setName(s.getName());
        vo.setClassName(klass == null ? null : klass.getName());
        vo.setEmail(s.getEmail());
        vo.setPhone(s.getPhone());
        return vo;
    }
}
