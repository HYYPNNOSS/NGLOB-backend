import {
  Controller, Post, Body, UseGuards, Headers, Req, RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService, CreatePaymentIntentDto } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('intent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create Stripe PaymentIntent — returns clientSecret for frontend' })
  createIntent(
    @Body() dto: CreatePaymentIntentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.createIntent(dto, user.id);
  }

  @Post('webhook')
  @ApiExcludeEndpoint() // don't show in Swagger
  webhook(
    @Headers('stripe-signature') sig: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.paymentsService.handleWebhook(sig, req.rawBody as Buffer);
  }
}
