package com.auwallet.wallet.service;

import com.auwallet.academic.entity.Student;
import com.auwallet.academic.entity.StudentProgramEnrollment;
import com.auwallet.academic.repository.StudentProgramEnrollmentRepository;
import com.auwallet.academic.repository.StudentRepository;
import com.auwallet.wallet.repository.WalletOnboardingRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Implements the locked automatic-match rule:
 *
 *   wallet_onboarding_request.admission_no        = academic.student.admission_no
 *   wallet_onboarding_request.date_of_birth        = academic.student.date_of_birth
 *   holder_account.university_email                = academic.student.university_email
 *   wallet_onboarding_request.passport_number_hmac = academic.student.passport_number_hmac
 *
 * All four must match the SAME student row. After identifying the student,
 * an eligible enrollment (academic_status in studying/graduated/alumni) is
 * selected, and it must not already be claimed by a different matched
 * holder (matched_enrollment_id is unique when present).
 *
 * Tie-break note: the locked plan does not specify which enrollment to pick
 * when a student has more than one eligible enrollment. This implementation
 * picks the earliest by enrollment_id. Revisit if the team confirms a
 * different rule.
 */
@Service
@RequiredArgsConstructor
public class MatchingService {

    private static final List<String> ELIGIBLE_STATUSES = List.of("studying", "graduated", "alumni");

    private final StudentRepository studentRepository;
    private final StudentProgramEnrollmentRepository enrollmentRepository;
    private final WalletOnboardingRequestRepository onboardingRequestRepository;

    public enum Outcome { MATCHED, UNDER_REVIEW, REJECTED }

    public record MatchResult(Outcome outcome, Long enrollmentId, String reason) {
        static MatchResult matched(Long enrollmentId) {
            return new MatchResult(Outcome.MATCHED, enrollmentId, null);
        }

        static MatchResult rejected(String reason) {
            return new MatchResult(Outcome.REJECTED, null, reason);
        }

        static MatchResult underReview(String reason) {
            return new MatchResult(Outcome.UNDER_REVIEW, null, reason);
        }
    }

    public MatchResult attemptMatch(String admissionNo, LocalDate dateOfBirth,
                                     String universityEmail, String passportNumberHmac) {

        String canonicalAdmissionNo = normalizeAdmissionNo(admissionNo);
        String canonicalEmail = normalizeEmail(universityEmail);

        Optional<Student> studentOpt = studentRepository.findByFourFieldMatch(
                canonicalAdmissionNo, dateOfBirth, canonicalEmail, passportNumberHmac);

        if (studentOpt.isEmpty()) {
            return MatchResult.rejected("No academic record matched all four submitted identity fields.");
        }

        Student student = studentOpt.get();

        List<StudentProgramEnrollment> enrollments =
                enrollmentRepository.findByStudentIdOrderByEnrollmentIdAsc(student.getStudentId());

        Optional<StudentProgramEnrollment> eligible = enrollments.stream()
                .filter(e -> ELIGIBLE_STATUSES.contains(e.getAcademicStatus()))
                .filter(e -> !isEnrollmentAlreadyClaimed(e.getEnrollmentId()))
                .findFirst();

        if (eligible.isEmpty()) {
            return MatchResult.underReview(
                    "A matching student record was found, but no eligible, unclaimed enrollment exists. "
                            + "Routed to manual review.");
        }

        return MatchResult.matched(eligible.get().getEnrollmentId());
    }

    private boolean isEnrollmentAlreadyClaimed(Long enrollmentId) {
        return onboardingRequestRepository.findByMatchedEnrollmentId(enrollmentId).isPresent();
    }

    static String normalizeAdmissionNo(String admissionNo) {
        return admissionNo == null ? null : admissionNo.trim().toUpperCase();
    }

    static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }
}
