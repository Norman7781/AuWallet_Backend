package com.auwallet.academic.repository;

import com.auwallet.academic.entity.CourseResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CourseResultRepository extends JpaRepository<CourseResult, Long> {

    List<CourseResult> findByEnrollmentId(Long enrollmentId);
}
