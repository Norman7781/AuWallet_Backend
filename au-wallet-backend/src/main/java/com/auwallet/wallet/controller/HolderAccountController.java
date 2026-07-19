package com.auwallet.wallet.controller;

import com.auwallet.wallet.dto.CreateHolderAccountRequest;
import com.auwallet.wallet.dto.HolderAccountResponse;
import com.auwallet.wallet.dto.HolderProfileResponse;
import com.auwallet.wallet.entity.HolderAccount;
import com.auwallet.wallet.service.HolderAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/holder-accounts")
@RequiredArgsConstructor
@Tag(name = "Holder Accounts", description = "Wallet account creation and status")
public class HolderAccountController {

    private final HolderAccountService holderAccountService;

    @PostMapping
    @Operation(summary = "Create a pending wallet account",
            description = "First step of the flow: create a pending holder account keyed by university email. "
                    + "No identity matching happens yet - call the onboarding-requests endpoint next.")
    public ResponseEntity<HolderAccountResponse> create(@Valid @RequestBody CreateHolderAccountRequest request) {
        HolderAccount created = holderAccountService.createPendingAccount(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(HolderAccountResponse.from(created));
    }

    @GetMapping("/{holderAccountId}")
    @Operation(summary = "Get holder account status")
    public HolderAccountResponse get(@PathVariable Long holderAccountId) {
        return HolderAccountResponse.from(holderAccountService.getOrThrow(holderAccountId));
    }

    @GetMapping("/{holderAccountId}/profile")
    @Operation(summary = "Get resolved wallet profile",
            description = "Resolves the official academic name (if matched) through "
                    + "matched_enrollment_id -> student_program_enrollment -> student. "
                    + "Returns null name fields if no match exists yet.")
    public HolderProfileResponse getProfile(@PathVariable Long holderAccountId) {
        return holderAccountService.getProfile(holderAccountId);
    }
}
