package com.auwallet.wallet.controller;

import com.auwallet.wallet.dto.IdentityDocumentResponse;
import com.auwallet.wallet.dto.UploadIdentityDocumentRequest;
import com.auwallet.wallet.entity.UploadedIdentityDocument;
import com.auwallet.wallet.service.OnboardingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/onboarding-requests/{onboardingRequestId}/documents")
@RequiredArgsConstructor
@Tag(name = "Identity Documents", description = "Optional evidence metadata for manual review (e.g. a passport photo)")
public class IdentityDocumentController {

    private final OnboardingService onboardingService;

    @PostMapping
    @Operation(summary = "Attach identity document metadata",
            description = "Records METADATA only (document_type, storage_object_path, etc). "
                    + "The file itself must already be uploaded to a private Supabase Storage bucket; "
                    + "this endpoint does not accept raw file bytes. Optional - only used for manual review.")
    public ResponseEntity<IdentityDocumentResponse> attach(
            @PathVariable Long onboardingRequestId,
            @Valid @RequestBody UploadIdentityDocumentRequest request) {
        UploadedIdentityDocument saved = onboardingService.attachDocument(
                onboardingRequestId, request.documentType(), request.storageObjectPath(),
                request.originalFileName(), request.mimeType(), request.fileSizeBytes(), request.fileHash());
        return ResponseEntity.status(HttpStatus.CREATED).body(IdentityDocumentResponse.from(saved));
    }

    @GetMapping
    @Operation(summary = "List identity document metadata for an onboarding request")
    public List<IdentityDocumentResponse> list(@PathVariable Long onboardingRequestId) {
        return onboardingService.listDocuments(onboardingRequestId).stream()
                .map(IdentityDocumentResponse::from)
                .toList();
    }
}
