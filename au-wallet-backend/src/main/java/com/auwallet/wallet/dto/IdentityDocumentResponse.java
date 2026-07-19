package com.auwallet.wallet.dto;

import com.auwallet.wallet.entity.UploadedIdentityDocument;

import java.time.OffsetDateTime;

public record IdentityDocumentResponse(
        Long uploadedIdentityDocumentId,
        Long onboardingRequestId,
        String documentType,
        String storageObjectPath,
        String originalFileName,
        OffsetDateTime uploadedAt
) {
    public static IdentityDocumentResponse from(UploadedIdentityDocument doc) {
        return new IdentityDocumentResponse(
                doc.getUploadedIdentityDocumentId(),
                doc.getOnboardingRequestId(),
                doc.getDocumentType(),
                doc.getStorageObjectPath(),
                doc.getOriginalFileName(),
                doc.getUploadedAt()
        );
    }
}
