import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import {
  EnvironmentVariables,
  PASSPORT_HMAC_SECRET_DOCUMENTATION_PLACEHOLDER,
} from '../../config/environment';

@Injectable()
export class PassportHmacService {
  private readonly secret: Buffer;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    const secret: unknown = configService.get('PASSPORT_HMAC_SECRET', {
      infer: true,
    });

    if (typeof secret !== 'string' || secret.trim().length === 0) {
      throw new Error('PASSPORT_HMAC_SECRET is required');
    }

    const normalizedSecret = secret.trim();

    if (normalizedSecret === PASSPORT_HMAC_SECRET_DOCUMENTATION_PLACEHOLDER) {
      throw new Error(
        'PASSPORT_HMAC_SECRET must not use the documentation placeholder',
      );
    }

    if (Buffer.byteLength(normalizedSecret, 'utf8') < 32) {
      throw new Error('PASSPORT_HMAC_SECRET must be at least 32 bytes');
    }

    this.secret = Buffer.from(normalizedSecret, 'utf8');
  }

  computePassportHmac(passportIdentifier: string): string {
    const normalized = this.normalize(passportIdentifier);

    return createHmac('sha256', this.secret)
      .update(normalized, 'utf8')
      .digest('hex');
  }

  private normalize(passportIdentifier: string): string {
    if (typeof passportIdentifier !== 'string') {
      throw new BadRequestException('A passport identifier is required');
    }

    const normalized = passportIdentifier
      .normalize('NFKC')
      .trim()
      .replace(/[\s-]/gu, '')
      .toUpperCase();

    if (!normalized) {
      throw new BadRequestException('A passport identifier is required');
    }

    return normalized;
  }
}
