package com.auwallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Metadata only. The actual file bytes should already be uploaded to a
 * private Supabase Storage bucket by the client (or a signed-URL upload
 * flow) before calling this endpoint; storageObjectPath is the resulting
 * object path/key, not a file payload.
 */
public record UploadIdentityDocumentRequest(

        @NotBlank
        String documentType,

        @NotBlank
        String storageObjectPath,

        String originalFileName,

        String mimeType,

        Integer fileSizeBytes,

        String fileHash
) {
}
