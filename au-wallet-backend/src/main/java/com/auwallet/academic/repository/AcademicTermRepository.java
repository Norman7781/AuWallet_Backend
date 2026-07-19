package com.auwallet.academic.repository;

import com.auwallet.academic.entity.AcademicTerm;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AcademicTermRepository extends JpaRepository<AcademicTerm, Long> {
}
