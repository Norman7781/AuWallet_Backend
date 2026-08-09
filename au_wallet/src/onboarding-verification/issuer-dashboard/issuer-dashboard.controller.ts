import { Controller, Get, UseGuards } from '@nestjs/common';
import { IssuerDashboardService } from './issuer-dashboard.service';
import { NonProductionDashboardGuard } from './non-production-dashboard.guard';

@Controller('issuer/dashboard')
@UseGuards(NonProductionDashboardGuard)
export class IssuerDashboardController {
  constructor(private readonly dashboard: IssuerDashboardService) {}

  @Get('connection-summary')
  getConnectionSummary() {
    return this.dashboard.getConnectionSummary();
  }
}
