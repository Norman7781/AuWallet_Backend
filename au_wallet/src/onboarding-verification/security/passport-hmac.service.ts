import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

@Injectable()
export class PassportHmacService {
  private readonly secret: Buffer;

  constructor(configService: ConfigService) {
    const secret = configService.get<unknown>('PASSPORT_HMAC_SECRET');

    if (typeof secret !== 'string' || secret.trim().length === 0) {
      throw new Error('PASSPORT_HMAC_SECRET is required');
    }

    this.secret = Buffer.from(secret, 'utf8');
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
