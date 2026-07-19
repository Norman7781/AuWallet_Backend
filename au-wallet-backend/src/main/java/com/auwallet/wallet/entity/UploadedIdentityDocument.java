package com.auwallet.wallet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Mirrors wallet.uploaded_identity_document. Stores METADATA only - the
 * actual file (e.g. a passport photo) belongs in private object storage
 * (Supabase Storage bucket, private/authenticated access) referenced by
 * storage_object_path. This table never stores raw passport numbers.
 *
 * Optional, evidence for manual review only - never required when the
 * automatic four-field match already succeeds.
 */
@Entity
@Table(name = "uploaded_identity_document", schema = "wallet")
@Getter
@Setter
@NoArgsConstructor
public class UploadedIdentityDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "uploaded_identity_document_id")
    private Long uploadedIdentityDocumentId;

    @Column(name = "onboarding_request_id", nullable = false)
    private Long onboardingRequestId;

    /** passport | national_id | other */
    @Column(name = "document_type", nullable = false)
    private String documentType;

    @Column(name = "storage_object_path", nullable = false)
    private String storageObjectPath;

    @Column(name = "original_file_name")
    private String originalFileName;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "file_size_bytes")
    private Integer fileSizeBytes;

    @Column(name = "file_hash")
    private String fileHash;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private OffsetDateTime uploadedAt;

    @PrePersist
    void onCreate() {
        this.uploadedAt = OffsetDateTime.now();
    }
}
