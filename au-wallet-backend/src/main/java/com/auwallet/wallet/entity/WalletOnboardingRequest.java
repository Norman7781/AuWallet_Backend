package com.auwallet.wallet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Mirrors wallet.wallet_onboarding_request. Stores one submitted matching
 * attempt. Never stores a raw passport number - only passport_number_hmac.
 *
 * matched_enrollment_id is a LOGICAL reference to
 * academic.student_program_enrollment.enrollment_id. It is intentionally not
 * a database-enforced foreign key here (see README: physical deployment /
 * cross-schema FK enforcement is still undecided per the locked plan).
 */
@Entity
@Table(name = "wallet_onboarding_request", schema = "wallet")
@Getter
@Setter
@NoArgsConstructor
public class WalletOnboardingRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "onboarding_request_id")
    private Long onboardingRequestId;

    @Column(name = "holder_account_id", nullable = false)
    private Long holderAccountId;

    @Column(name = "admission_no", nullable = false)
    private String admissionNo;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(name = "passport_number_hmac", nullable = false)
    private String passportNumberHmac;

    /** submitted | under_review | matched | rejected */
    @Column(name = "verification_status", nullable = false)
    private String verificationStatus = "submitted";

    @Column(name = "matched_enrollment_id", unique = true)
    private Long matchedEnrollmentId;

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private OffsetDateTime submittedAt;

    @PrePersist
    void onCreate() {
        this.submittedAt = OffsetDateTime.now();
        if (this.verificationStatus == null) {
            this.verificationStatus = "submitted";
        }
    }
}
