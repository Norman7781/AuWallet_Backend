package com.auwallet.academic.repository;

import com.auwallet.academic.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface StudentRepository extends JpaRepository<Student, Long> {

    /**
     * The locked automatic-match rule: all four fields must match the SAME
     * academic student row. Callers must pass already-normalized values
     * (admissionNo canonical case, email lower-cased/trimmed, dob exact,
     * passportNumberHmac already hashed - never the raw passport number).
     */
    @Query("""
            select s from Student s
            where s.admissionNo = :admissionNo
              and s.dateOfBirth = :dateOfBirth
              and s.universityEmail = :universityEmail
              and s.passportNumberHmac = :passportNumberHmac
            """)
    Optional<Student> findByFourFieldMatch(
            @Param("admissionNo") String admissionNo,
            @Param("dateOfBirth") LocalDate dateOfBirth,
            @Param("universityEmail") String universityEmail,
            @Param("passportNumberHmac") String passportNumberHmac
    );

    Optional<Student> findByUniversityEmail(String universityEmail);
}
