import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check system health' })
  @ApiResponse({
    status: 200,
    description: 'Returns the health status of various system components',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'error'] },
        timestamp: { type: 'string', format: 'date-time' },
        environment: { type: 'string' },
        checks: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'error'] },
                error: { type: 'string', nullable: true },
              },
            },
            email: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'error'] },
                error: { type: 'string', nullable: true },
              },
            },
            environment: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'error'] },
                error: { type: 'string', nullable: true },
              },
            },
          },
        },
        errors: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  async checkHealth() {
    return this.healthService.checkHealth();
  }
}