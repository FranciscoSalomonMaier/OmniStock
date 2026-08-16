import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthResponse, HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check API and database availability' })
  @ApiOkResponse({ description: 'API and database are available' })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable' })
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
