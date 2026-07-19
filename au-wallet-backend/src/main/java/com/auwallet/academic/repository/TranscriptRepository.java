package com.auwallet.academic.repository;

import com.auwallet.academic.entity.Transcript;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TranscriptRepository extends JpaRepository<Transcript, Long> {

    Optional<Transcript> findByEnrollmentId(Long enrollmentId);
}
