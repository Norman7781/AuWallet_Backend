package com.auwallet.wallet.dto;

import com.auwallet.wallet.entity.WalletOnboardingRequest;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record OnboardingRequestResponse(
        Long onboardingRequestId,
        Long holderAccountId,
        String admissionNo,
        LocalDate dateOfBirth,
        String verificationStatus,
        Long matchedEnrollmentId,
        String rejectionReason,
        OffsetDateTime submittedAt,
        OffsetDateTime reviewedAt
) {
    public static OnboardingRequestResponse from(WalletOnboardingRequest req) {
        return new OnboardingRequestResponse(
                req.getOnboardingRequestId(),
                req.getHolderAccountId(),
                req.getAdmissionNo(),
                req.getDateOfBirth(),
                req.getVerificationStatus(),
                req.getMatchedEnrollmentId(),
                req.getRejectionReason(),
                req.getSubmittedAt(),
                req.getReviewedAt()
        );
        // Note: passport number (raw or hashed) is intentionally never
        // included in any response DTO.
    }
}
