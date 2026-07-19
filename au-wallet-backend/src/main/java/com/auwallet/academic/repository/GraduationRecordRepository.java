package com.auwallet.academic.repository;

import com.auwallet.academic.entity.GraduationRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GraduationRecordRepository extends JpaRepository<GraduationRecord, Long> {

    Optional<GraduationRecord> findByEnrollmentId(Long enrollmentId);
}
