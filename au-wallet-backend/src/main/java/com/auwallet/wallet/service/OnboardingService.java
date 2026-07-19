package com.auwallet.wallet.service;

import com.auwallet.common.exception.ApiException;
import com.auwallet.common.security.PassportHmacService;
import com.auwallet.wallet.dto.SubmitOnboardingRequest;
import com.auwallet.wallet.entity.HolderAccount;
import com.auwallet.wallet.entity.UploadedIdentityDocument;
import com.auwallet.wallet.entity.WalletOnboardingRequest;
import com.auwallet.wallet.repository.HolderAccountRepository;
import com.auwallet.wallet.repository.UploadedIdentityDocumentRepository;
import com.auwallet.wallet.repository.WalletOnboardingRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OnboardingService {

    private final HolderAccountRepository holderAccountRepository;
    private final WalletOnboardingRequestRepository onboardingRequestRepository;
    private final UploadedIdentityDocumentRepository documentRepository;
    private final PassportHmacService passportHmacService;
    private final MatchingService matchingService;

    /**
     * Submits one matching attempt. Per the locked plan a holder may retry,
     * but only one request per holder may be in flight / matched at a time.
     */
    @Transactional
    public WalletOnboardingRequest submit(Long holderAccountId, SubmitOnboardingRequest request) {
        HolderAccount account = holderAccountRepository.findById(holderAccountId)
                .orElseThrow(() -> ApiException.notFound("Holder account not found: " + holderAccountId));

        if (onboardingRequestRepository.existsByHolderAccountIdAndVerificationStatus(holderAccountId, "matched")) {
            throw ApiException.conflict("This holder account is already matched to an academic enrollment.");
        }

        // Raw passport number is hashed immediately; it is not assigned to
        // any field or variable beyond this line.
        String passportNumberHmac = passportHmacService.hash(request.passportNumber());

        WalletOnboardingRequest entity = new WalletOnboardingRequest();
        entity.setHolderAccountId(holderAccountId);
        entity.setAdmissionNo(request.admissionNo().trim());
        entity.setDateOfBirth(request.dateOfBirth());
        entity.setPassportNumberHmac(passportNumberHmac);
        entity.setVerificationStatus("submitted");
        entity = onboardingRequestRepository.save(entity);

        MatchingService.MatchResult result = matchingService.attemptMatch(
                entity.getAdmissionNo(), entity.getDateOfBirth(), account.getUniversityEmail(), passportNumberHmac);

        switch (result.outcome()) {
            case MATCHED -> {
                entity.setVerificationStatus("matched");
                entity.setMatchedEnrollmentId(result.enrollmentId());
                entity.setReviewedAt(OffsetDateTime.now());

                account.setAccountStatus("active");
                account.setConfirmedAt(OffsetDateTime.now());
                holderAccountRepository.save(account);
            }
            case UNDER_REVIEW -> entity.setVerificationStatus("under_review");
            case REJECTED -> {
                entity.setVerificationStatus("rejected");
                entity.setRejectionReason(result.reason());
            }
        }

        return onboardingRequestRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public List<WalletOnboardingRequest> listForHolder(Long holderAccountId) {
        return onboardingRequestRepository.findByHolderAccountIdOrderBySubmittedAtDesc(holderAccountId);
    }

    @Transactional(readOnly = true)
    public WalletOnboardingRequest getOrThrow(Long onboardingRequestId) {
        return onboardingRequestRepository.findById(onboardingRequestId)
                .orElseThrow(() -> ApiException.notFound("Onboarding request not found: " + onboardingRequestId));
    }

    /**
     * Manual review decision. "matched" requires the reviewer to have already
     * identified one real academic enrollment (enrollmentId); this method
     * does not itself search the academic database on the reviewer's behalf.
     */
    @Transactional
    public WalletOnboardingRequest applyReviewDecision(Long onboardingRequestId, String decision,
                                                         Long enrollmentId, String rejectionReason,
                                                         String reviewedBy) {
        WalletOnboardingRequest entity = getOrThrow(onboardingRequestId);

        if (!"under_review".equals(entity.getVerificationStatus())
                && !"submitted".equals(entity.getVerificationStatus())) {
            throw ApiException.conflict("Only submitted or under_review requests can receive a review decision.");
        }

        if ("matched".equalsIgnoreCase(decision)) {
            if (enrollmentId == null) {
                throw ApiException.badRequest("enrollmentId is required to record a manual match.");
            }
            if (onboardingRequestRepository.findByMatchedEnrollmentId(enrollmentId).isPresent()) {
                throw ApiException.conflict("That academic enrollment is already claimed by another holder.");
            }

            entity.setVerificationStatus("matched");
            entity.setMatchedEnrollmentId(enrollmentId);
            entity.setRejectionReason(null);

            HolderAccount account = holderAccountRepository.findById(entity.getHolderAccountId())
                    .orElseThrow(() -> ApiException.notFound("Holder account not found."));
            account.setAccountStatus("active");
            account.setConfirmedAt(OffsetDateTime.now());
            holderAccountRepository.save(account);

        } else if ("rejected".equalsIgnoreCase(decision)) {
            entity.setVerificationStatus("rejected");
            entity.setMatchedEnrollmentId(null);
            entity.setRejectionReason(rejectionReason != null ? rejectionReason : "Rejected on manual review.");
        } else {
            throw ApiException.badRequest("decision must be 'matched' or 'rejected'.");
        }

        entity.setReviewedBy(reviewedBy);
        entity.setReviewedAt(OffsetDateTime.now());
        return onboardingRequestRepository.save(entity);
    }

    @Transactional
    public UploadedIdentityDocument attachDocument(Long onboardingRequestId, String documentType,
                                                     String storageObjectPath, String originalFileName,
                                                     String mimeType, Integer fileSizeBytes, String fileHash) {
        // Ensures the parent request exists before recording metadata.
        getOrThrow(onboardingRequestId);

        UploadedIdentityDocument doc = new UploadedIdentityDocument();
        doc.setOnboardingRequestId(onboardingRequestId);
        doc.setDocumentType(documentType);
        doc.setStorageObjectPath(storageObjectPath);
        doc.setOriginalFileName(originalFileName);
        doc.setMimeType(mimeType);
        doc.setFileSizeBytes(fileSizeBytes);
        doc.setFileHash(fileHash);
        return documentRepository.save(doc);
    }

    @Transactional(readOnly = true)
    public List<UploadedIdentityDocument> listDocuments(Long onboardingRequestId) {
        return documentRepository.findByOnboardingRequestId(onboardingRequestId);
    }
}
