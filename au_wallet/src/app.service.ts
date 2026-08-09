import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      data: { status: 'ok' as const },
      message: 'Service is healthy.',
      meta: {},
    };
  }
}
