package com.auwallet.academic.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Mirrors academic.student. Read-only from the wallet service's point of view.
 * Holds the official name and the four fields used for onboarding matching:
 * admission_no, date_of_birth, university_email, passport_number_hmac.
 */
@Entity
@Table(name = "student", schema = "academic")
@Getter
@Setter
@NoArgsConstructor
public class Student {

    @Id
    @Column(name = "student_id")
    private Long studentId;

    @Column(name = "admission_no")
    private String admissionNo;

    private String title;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "middle_name")
    private String middleName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "university_email")
    private String universityEmail;

    @Column(name = "personal_email")
    private String personalEmail;

    @Column(name = "passport_number_hmac")
    private String passportNumberHmac;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
