package com.auwallet.wallet.repository;

import com.auwallet.wallet.entity.WalletOnboardingRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WalletOnboardingRequestRepository extends JpaRepository<WalletOnboardingRequest, Long> {

    List<WalletOnboardingRequest> findByHolderAccountIdOrderBySubmittedAtDesc(Long holderAccountId);

    boolean existsByHolderAccountIdAndVerificationStatus(Long holderAccountId, String verificationStatus);

    Optional<WalletOnboardingRequest> findByMatchedEnrollmentId(Long matchedEnrollmentId);
}
