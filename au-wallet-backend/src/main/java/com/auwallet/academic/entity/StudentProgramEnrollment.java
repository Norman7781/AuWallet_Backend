package com.auwallet.academic.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "student_program_enrollment", schema = "academic")
@Getter
@Setter
@NoArgsConstructor
public class StudentProgramEnrollment {

    @Id
    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Column(name = "student_id")
    private Long studentId;

    @Column(name = "program_id")
    private Long programId;

    @Column(name = "admission_date")
    private LocalDate admissionDate;

    /** studying | graduated | alumni | withdrawn | suspended */
    @Column(name = "academic_status")
    private String academicStatus;

    @Column(name = "previous_institution_name")
    private String previousInstitutionName;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
