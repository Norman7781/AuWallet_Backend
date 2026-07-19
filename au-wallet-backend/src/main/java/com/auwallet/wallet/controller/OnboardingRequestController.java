package com.auwallet.wallet.controller;

import com.auwallet.wallet.dto.OnboardingRequestResponse;
import com.auwallet.wallet.dto.ReviewDecisionRequest;
import com.auwallet.wallet.dto.SubmitOnboardingRequest;
import com.auwallet.wallet.entity.WalletOnboardingRequest;
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
@RequiredArgsConstructor
@Tag(name = "Onboarding Requests", description = "Identity matching attempts against the academic database")
public class OnboardingRequestController {

    private final OnboardingService onboardingService;

    @PostMapping("/api/v1/holder-accounts/{holderAccountId}/onboarding-requests")
    @Operation(summary = "Submit a matching attempt",
            description = "Submits admission_no, date_of_birth, and passport_number "
                    + "(hashed server-side before persistence). university_email is taken from the "
                    + "parent holder account. Runs the automatic four-field match immediately and "
                    + "returns the outcome: matched, under_review, or rejected.")
    public ResponseEntity<OnboardingRequestResponse> submit(
            @PathVariable Long holderAccountId,
            @Valid @RequestBody SubmitOnboardingRequest request) {
        WalletOnboardingRequest saved = onboardingService.submit(holderAccountId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(OnboardingRequestResponse.from(saved));
    }

    @GetMapping("/api/v1/holder-accounts/{holderAccountId}/onboarding-requests")
    @Operation(summary = "List onboarding requests for a holder, most recent first")
    public List<OnboardingRequestResponse> listForHolder(@PathVariable Long holderAccountId) {
        return onboardingService.listForHolder(holderAccountId).stream()
                .map(OnboardingRequestResponse::from)
                .toList();
    }

    @GetMapping("/api/v1/onboarding-requests/{onboardingRequestId}")
    @Operation(summary = "Get one onboarding request")
    public OnboardingRequestResponse get(@PathVariable Long onboardingRequestId) {
        return OnboardingRequestResponse.from(onboardingService.getOrThrow(onboardingRequestId));
    }

    @PatchMapping("/api/v1/onboarding-requests/{onboardingRequestId}/review")
    @Operation(summary = "Record a manual review decision",
            description = "For requests in submitted/under_review status. A reviewer either confirms "
                    + "one real academic enrollment (decision=matched, enrollmentId required) or rejects "
                    + "the request (decision=rejected, rejectionReason recommended). "
                    + "reviewedBy is a free-text label only - not authoritative staff identity in this prototype.")
    public OnboardingRequestResponse review(
            @PathVariable Long onboardingRequestId,
            @Valid @RequestBody ReviewDecisionRequest request) {
        WalletOnboardingRequest updated = onboardingService.applyReviewDecision(
                onboardingRequestId, request.decision(), request.enrollmentId(),
                request.rejectionReason(), request.reviewedBy());
        return OnboardingRequestResponse.from(updated);
    }
}
