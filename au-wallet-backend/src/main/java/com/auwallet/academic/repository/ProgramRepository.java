package com.auwallet.academic.repository;

import com.auwallet.academic.entity.Program;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProgramRepository extends JpaRepository<Program, Long> {
}
