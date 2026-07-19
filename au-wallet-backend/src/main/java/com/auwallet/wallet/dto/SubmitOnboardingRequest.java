package com.auwallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;

import java.time.LocalDate;

/**
 * Required for automatic matching, per the locked plan: admission number,
 * date of birth, and passport number. University email is NOT repeated here
 * - it is read from the parent holder_account.
 *
 * passportNumber is the RAW value. It is hashed via PassportHmacService
 * immediately on entry to the service layer and is never persisted,
 * logged, or echoed back in any response.
 */
public record SubmitOnboardingRequest(

        @NotBlank
        String admissionNo,

        @NotNull
        @Past
        LocalDate dateOfBirth,

        @NotBlank
        String passportNumber
) {
    @Override
    public String toString() {
        // Defensive: guarantees the raw passport number can never leak via
        // an accidental log.debug(request) / exception message.
        return "SubmitOnboardingRequest[admissionNo=%s, dateOfBirth=%s, passportNumber=***redacted***]"
                .formatted(admissionNo, dateOfBirth);
    }
}
