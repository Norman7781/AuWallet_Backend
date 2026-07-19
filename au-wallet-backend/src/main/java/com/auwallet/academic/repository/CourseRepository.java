package com.auwallet.academic.repository;

import com.auwallet.academic.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseRepository extends JpaRepository<Course, Long> {
}
