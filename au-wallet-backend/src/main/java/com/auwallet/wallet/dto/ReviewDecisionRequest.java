package com.auwallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * decision = "matched" requires enrollmentId (the academic enrollment the
 * reviewer has confirmed). decision = "rejected" requires rejectionReason.
 * reviewedBy is a free-text synthetic reviewer label for the prototype -
 * NOT authoritative staff identity or audit evidence (real staff/Auth
 * reference is explicitly deferred in the locked plan).
 */
public record ReviewDecisionRequest(

        @NotBlank
        String decision,

        Long enrollmentId,

        String rejectionReason,

        @NotNull
        String reviewedBy
) {
}
