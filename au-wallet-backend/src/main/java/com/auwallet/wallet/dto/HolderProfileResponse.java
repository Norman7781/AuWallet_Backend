package com.auwallet.wallet.dto;

/**
 * The official name is resolved on demand through the match chain:
 * holder_account -> matched wallet_onboarding_request.matched_enrollment_id
 * -> academic.student_program_enrollment.student_id -> academic.student.
 *
 * It is deliberately not cached as a second copy in the wallet database.
 */
public record HolderProfileResponse(
        Long holderAccountId,
        String accountStatus,
        String universityEmail,
        String officialTitle,
        String officialFirstName,
        String officialMiddleName,
        String officialLastName,
        String academicStatus,
        Long matchedEnrollmentId
) {
}
