package com.demo.campus.course.controller;

import com.demo.campus.common.result.Result;
import com.demo.campus.course.dto.CourseVO;
import com.demo.campus.course.entity.Course;
import com.demo.campus.course.service.CourseService;
import com.demo.campus.student.dto.PageResult;
import com.demo.campus.auth.interceptor.LoginInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 选课：课程浏览、选课、退课、课表 */
@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public Result<PageResult<CourseVO>> list(@RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "10") int size) {
        return Result.ok(courseService.listCourses(page, size));
    }

    @GetMapping("/{id}")
    public Result<CourseVO> detail(@PathVariable Long id) {
        return Result.ok(courseService.getCourse(id));
    }

    /** 学生选课（userId 取自登录态） */
    @PostMapping("/{id}/enroll")
    public Result<Void> enroll(@PathVariable Long id, HttpServletRequest request) {
        Long studentId = currentStudentId(request);
        courseService.enroll(id, studentId);
        return Result.ok(null);
    }

    /** 学生退课 */
    @PostMapping("/{id}/drop")
    public Result<Void> drop(@PathVariable Long id, HttpServletRequest request) {
        Long studentId = currentStudentId(request);
        courseService.drop(id, studentId);
        return Result.ok(null);
    }

    /** 我的选课列表（课表） */
    @GetMapping("/my")
    public Result<List<CourseVO>> myCourses(HttpServletRequest request) {
        Long studentId = currentStudentId(request);
        return Result.ok(courseService.listMyCourses(studentId));
    }

    @PostMapping
    public Result<Long> add(@RequestBody Course course) {
        return Result.ok(courseService.addCourse(course));
    }

    /** 演示用：从拦截器写入的属性里取当前用户，作为 studentId */
    private Long currentStudentId(HttpServletRequest request) {
        Object userId = request.getAttribute("userId");
        return userId == null ? null : Long.valueOf(userId.toString());
    }
}
