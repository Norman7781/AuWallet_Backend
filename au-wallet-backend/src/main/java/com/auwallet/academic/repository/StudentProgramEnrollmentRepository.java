package com.auwallet.academic.repository;

import com.auwallet.academic.entity.StudentProgramEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentProgramEnrollmentRepository extends JpaRepository<StudentProgramEnrollment, Long> {

    List<StudentProgramEnrollment> findByStudentIdOrderByEnrollmentIdAsc(Long studentId);
}
