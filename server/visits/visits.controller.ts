import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { VisitsService } from './visits.service'

@UseGuards(AuthGuard)
@Controller('api')
export class VisitsController {
  constructor(private readonly service: VisitsService) {}

  @Get('visits')
  visits(@Query('days') days?: string) {
    if (days !== undefined && days !== '7' && days !== '30' && days !== '90') {
      throw new BadRequestException('days debe ser 7, 30 o 90.')
    }
    return this.service.summary(Number(days ?? '30'))
  }
}
