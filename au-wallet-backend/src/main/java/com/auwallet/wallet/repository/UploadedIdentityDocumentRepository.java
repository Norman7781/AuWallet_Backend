package com.auwallet.wallet.repository;

import com.auwallet.wallet.entity.UploadedIdentityDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UploadedIdentityDocumentRepository extends JpaRepository<UploadedIdentityDocument, Long> {

    List<UploadedIdentityDocument> findByOnboardingRequestId(Long onboardingRequestId);
}
