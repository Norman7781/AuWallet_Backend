package com.auwallet.academic.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "graduation_record", schema = "academic")
@Getter
@Setter
@NoArgsConstructor
public class GraduationRecord {

    @Id
    @Column(name = "graduation_record_id")
    private Long graduationRecordId;

    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Column(name = "graduation_date")
    private LocalDate graduationDate;

    @Column(name = "total_credits_completed")
    private BigDecimal totalCreditsCompleted;

    @Column(name = "total_credits_transferred")
    private BigDecimal totalCreditsTransferred;

    @Column(name = "total_credits_earned")
    private BigDecimal totalCreditsEarned;

    @Column(name = "cumulative_gpa")
    private BigDecimal cumulativeGpa;

    private String award;

    @Column(name = "requirements_fulfilled")
    private Boolean requirementsFulfilled;

    /** pending | completed | rescinded */
    @Column(name = "graduation_status")
    private String graduationStatus;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;
}
