import { Injectable } from '@nestjs/common';
import type { IssuerConnectionSummaryResponse } from './issuer-dashboard.interface';
import { IssuerDashboardRepository } from './issuer-dashboard.repository';

@Injectable()
export class IssuerDashboardService {
  constructor(private readonly dashboard: IssuerDashboardRepository) {}

  async getConnectionSummary(): Promise<IssuerConnectionSummaryResponse> {
    return {
      data: await this.dashboard.loadConnectionSummary(),
      message: 'Issuer connection summary loaded.',
      meta: {},
    };
  }
}
