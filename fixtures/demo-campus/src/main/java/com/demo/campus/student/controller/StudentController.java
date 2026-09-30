package com.demo.campus.student.controller;

import com.demo.campus.common.result.Result;
import com.demo.campus.student.dto.PageResult;
import com.demo.campus.student.dto.StudentVO;
import com.demo.campus.student.entity.Student;
import com.demo.campus.student.service.StudentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 学籍管理：学生增删改查 */
@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {

    private final StudentService studentService;

    /** 分页查询学生列表，附带班级名 */
    @GetMapping
    public Result<PageResult<StudentVO>> list(@RequestParam(defaultValue = "1") int page,
                                              @RequestParam(defaultValue = "10") int size) {
        return Result.ok(studentService.listStudents(page, size));
    }

    /** 按姓名关键字搜索学生 */
    @GetMapping("/search")
    public Result<List<StudentVO>> search(@RequestParam String keyword) {
        return Result.ok(studentService.searchByName(keyword));
    }

    @GetMapping("/{id}")
    public Result<StudentVO> detail(@PathVariable Long id) {
        return Result.ok(studentService.getStudent(id));
    }

    @PostMapping
    public Result<Long> add(@RequestBody Student student) {
        return Result.ok(studentService.addStudent(student));
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody Student student) {
        student.setId(id);
        studentService.updateStudent(student);
        return Result.ok(null);
    }

    @DeleteMapping("/{id}")
    public Result<Void> remove(@PathVariable Long id) {
        studentService.removeStudent(id);
        return Result.ok(null);
    }
}
