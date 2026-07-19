package com.auwallet.common.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PassportHmacServiceTest {

    private final PassportHmacService service = new PassportHmacService("test-secret");

    @Test
    void normalizesWhitespaceAndCase() {
        assertEquals("P1234567", service.normalize("  p1234 567 "));
    }

    @Test
    void sameNormalizedInputProducesSameHash() {
        assertEquals(service.hash("P1234567"), service.hash("p1234567"));
        assertEquals(service.hash("P1234567"), service.hash(" P1234567 "));
    }

    @Test
    void differentInputProducesDifferentHash() {
        assertNotEquals(service.hash("P1234567"), service.hash("P7654321"));
    }

    @Test
    void hashNeverEqualsRawInput() {
        String raw = "P1234567";
        assertNotEquals(raw, service.hash(raw));
    }

    @Test
    void blankPassportIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.hash("   "));
    }
}
