package com.demo.campus.course.service;

import com.demo.campus.common.exception.BusinessException;
import com.demo.campus.course.dto.CourseVO;
import com.demo.campus.course.entity.Course;
import com.demo.campus.course.entity.Enrollment;
import com.demo.campus.course.mapper.CourseMapper;
import com.demo.campus.course.mapper.EnrollmentMapper;
import com.demo.campus.student.dto.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** 选课核心业务 */
@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseMapper courseMapper;
    private final EnrollmentMapper enrollmentMapper;

    public PageResult<CourseVO> listCourses(int page, int size) {
        long total = courseMapper.count();
        List<Course> courses = courseMapper.selectPage((page - 1) * size, size);
        List<CourseVO> voList = new ArrayList<>();
        for (Course c : courses) {
            voList.add(toVO(c, null));
        }
        return new PageResult<>(total, voList);
    }

    public CourseVO getCourse(Long id) {
        Course course = courseMapper.selectById(id);
        if (course == null) {
            throw new BusinessException("课程不存在");
        }
        return toVO(course, null);
    }

    /** 选课：查课、查重复、查容量、插入选课记录、更新课程人数 */
    public void enroll(Long courseId, Long studentId) {
        Course course = courseMapper.selectById(courseId);
        if (course == null) {
            throw new BusinessException("课程不存在");
        }
        Enrollment exist = enrollmentMapper.selectActive(courseId, studentId);
        if (exist != null) {
            throw new BusinessException("请勿重复选课");
        }
        // 先判断容量，再插入记录、再更新人数：三步之间没有事务保护
        if (course.getEnrolled() >= course.getCapacity()) {
            throw new BusinessException("课程已满");
        }
        Enrollment enrollment = new Enrollment();
        enrollment.setCourseId(courseId);
        enrollment.setStudentId(studentId);
        enrollment.setStatus("ACTIVE");
        enrollmentMapper.insert(enrollment);
        courseMapper.changeEnrolled(courseId, 1);
    }

    /** 退课：把选课记录置为 DROPPED，并把课程人数减一 */
    public void drop(Long courseId, Long studentId) {
        // 直接置状态，未校验是否存在有效的选课记录
        enrollmentMapper.markDropped(courseId, studentId);
        courseMapper.changeEnrolled(courseId, -1);
    }

    public List<CourseVO> listMyCourses(Long studentId) {
        List<Enrollment> enrollments = enrollmentMapper.selectByStudent(studentId);
        List<CourseVO> voList = new ArrayList<>();
        for (Enrollment e : enrollments) {
            Course course = courseMapper.selectById(e.getCourseId());
            if (course != null) {
                voList.add(toVO(course, e.getStatus()));
            }
        }
        return voList;
    }

    public Long addCourse(Course course) {
        course.setEnrolled(0);
        courseMapper.insert(course);
        return course.getId();
    }

    private CourseVO toVO(Course c, String status) {
        CourseVO vo = new CourseVO();
        vo.setId(c.getId());
        vo.setName(c.getName());
        vo.setTeacher(c.getTeacher());
        vo.setClassroom(c.getClassroom());
        vo.setSchedule(c.getSchedule());
        vo.setCapacity(c.getCapacity());
        vo.setEnrolled(c.getEnrolled());
        vo.setStatus(status);
        if (c.getCapacity() != null && c.getCapacity() > 0) {
            vo.setEnrolledPercent(c.getEnrolled() * 100 / c.getCapacity());
        }
        return vo;
    }
}
