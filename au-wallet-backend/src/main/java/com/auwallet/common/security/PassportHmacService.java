package com.auwallet.common.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Converts a raw passport number into a stable, non-reversible HMAC before it
 * ever reaches a repository, log line, or exception message.
 *
 * Locked-plan rule: "Do not store or log the raw passport number." The raw
 * value must live only as long as it takes to call {@link #hash(String)}.
 */
@Service
public class PassportHmacService {

    private static final String ALGORITHM = "HmacSHA256";

    private final SecretKeySpec keySpec;

    public PassportHmacService(@Value("${app.passport.hmac-secret}") String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("app.passport.hmac-secret must be configured");
        }
        this.keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM);
    }

    /**
     * Normalization contract (locked plan): trim, remove internal whitespace,
     * upper-case. Adjust here if the team documents a different canonical rule
     * before generating synthetic matching data.
     */
    public String normalize(String rawPassportNumber) {
        if (rawPassportNumber == null) {
            return null;
        }
        return rawPassportNumber.trim().replaceAll("\\s+", "").toUpperCase();
    }

    public String hash(String rawPassportNumber) {
        String normalized = normalize(rawPassportNumber);
        if (normalized == null || normalized.isEmpty()) {
            throw new IllegalArgumentException("passport number is required");
        }
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(keySpec);
            byte[] rawHmac = mac.doFinal(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(rawHmac);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Unable to compute passport HMAC", e);
        }
    }
}
