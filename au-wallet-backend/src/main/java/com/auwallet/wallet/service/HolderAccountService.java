package com.auwallet.wallet.service;

import com.auwallet.academic.entity.Student;
import com.auwallet.academic.entity.StudentProgramEnrollment;
import com.auwallet.academic.repository.StudentProgramEnrollmentRepository;
import com.auwallet.academic.repository.StudentRepository;
import com.auwallet.common.exception.ApiException;
import com.auwallet.wallet.dto.CreateHolderAccountRequest;
import com.auwallet.wallet.dto.HolderProfileResponse;
import com.auwallet.wallet.entity.HolderAccount;
import com.auwallet.wallet.entity.WalletOnboardingRequest;
import com.auwallet.wallet.repository.HolderAccountRepository;
import com.auwallet.wallet.repository.WalletOnboardingRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HolderAccountService {

    private final HolderAccountRepository holderAccountRepository;
    private final WalletOnboardingRequestRepository onboardingRequestRepository;
    private final StudentProgramEnrollmentRepository enrollmentRepository;
    private final StudentRepository studentRepository;

    @Transactional
    public HolderAccount createPendingAccount(CreateHolderAccountRequest request) {
        String universityEmail = normalizeEmail(request.universityEmail());

        if (holderAccountRepository.existsByUniversityEmail(universityEmail)) {
            throw ApiException.conflict("A holder account already exists for this university email.");
        }

        HolderAccount account = new HolderAccount();
        account.setUniversityEmail(universityEmail);
        account.setPersonalEmail(request.personalEmail());
        account.setAccountStatus("pending");
        return holderAccountRepository.save(account);
    }

    public HolderAccount getOrThrow(Long holderAccountId) {
        return holderAccountRepository.findById(holderAccountId)
                .orElseThrow(() -> ApiException.notFound("Holder account not found: " + holderAccountId));
    }

    /**
     * Resolves the official academic name and current academic status through
     * the match chain. Returns an unresolved profile (no official name) if the
     * account has no matched onboarding request yet.
     */
    @Transactional(readOnly = true)
    public HolderProfileResponse getProfile(Long holderAccountId) {
        HolderAccount account = getOrThrow(holderAccountId);

        WalletOnboardingRequest matched = onboardingRequestRepository
                .findByHolderAccountIdOrderBySubmittedAtDesc(holderAccountId).stream()
                .filter(r -> "matched".equals(r.getVerificationStatus()))
                .findFirst()
                .orElse(null);

        if (matched == null || matched.getMatchedEnrollmentId() == null) {
            return new HolderProfileResponse(
                    account.getHolderAccountId(),
                    account.getAccountStatus(),
                    account.getUniversityEmail(),
                    null, null, null, null, null, null
            );
        }

        StudentProgramEnrollment enrollment = enrollmentRepository.findById(matched.getMatchedEnrollmentId())
                .orElseThrow(() -> ApiException.notFound("Matched enrollment no longer exists in the academic database."));
        Student student = studentRepository.findById(enrollment.getStudentId())
                .orElseThrow(() -> ApiException.notFound("Matched student no longer exists in the academic database."));

        return new HolderProfileResponse(
                account.getHolderAccountId(),
                account.getAccountStatus(),
                account.getUniversityEmail(),
                student.getTitle(),
                student.getFirstName(),
                student.getMiddleName(),
                student.getLastName(),
                enrollment.getAcademicStatus(),
                enrollment.getEnrollmentId()
        );
    }

    static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }
}
