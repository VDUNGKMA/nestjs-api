// src/modules/payments/payment.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Headers,
  HttpCode,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { PaymentService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PayPalService } from './paypal.service';
import { Request } from 'express';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger('PaymentController');

  constructor(
    private readonly paymentService: PaymentService,
    private readonly paypalService: PayPalService,
  ) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Get('all')
  findAll() {
    return this.paymentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.remove(id);
  }

  // PayPal specific endpoints
  @Post('paypal/create-order')
  createPayPalOrder(
    @Body()
    orderData: {
      amount: number;
      currency?: string;
      description: string;
      returnUrl?: string;
      cancelUrl?: string;
      custom_id?: string;
    },
  ) {
    return this.paypalService.createOrder(
      orderData.amount,
      orderData.currency || 'USD',
      orderData.description,
      orderData.returnUrl,
      orderData.cancelUrl,
      orderData.custom_id,
    );
  }

  @Post('paypal/capture-payment')
  capturePayPalPayment(@Body() captureData: { orderId: string }) {
    return this.paypalService.capturePayment(captureData.orderId);
  }

  @Get('paypal/order-details')
  getPayPalOrderDetails(@Query('orderId') orderId: string) {
    return this.paypalService.getOrderDetails(orderId);
  }

  /**
   * PayPal webhook handler
   * This endpoint receives notifications from PayPal when payment status changes
   */
  @Post('paypal/webhook')
  @HttpCode(200)
  async handlePayPalWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('paypal-auth-algo') authAlgo: string,
    @Headers('paypal-cert-url') certUrl: string,
    @Headers('paypal-transmission-id') transmissionId: string,
    @Headers('paypal-transmission-sig') transmissionSig: string,
    @Headers('paypal-transmission-time') transmissionTime: string,
    @Body() webhookEvent: any,
  ) {
    this.logger.log(`Received PayPal webhook: ${webhookEvent.event_type}`);

    try {
      // Get the raw body for webhook verification
      const rawBody = req.rawBody?.toString() || JSON.stringify(webhookEvent);

      // Verify the webhook signature to ensure it's from PayPal
      const isVerified = await this.paypalService.verifyWebhookSignature({
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
        webhookEvent: rawBody,
      });

      if (!isVerified) {
        this.logger.warn('PayPal webhook signature verification failed');
        return {
          success: false,
          message: 'Webhook signature verification failed',
        };
      }

      // Process the webhook event
      return this.paypalService.handlePayPalWebhook(webhookEvent);
    } catch (error) {
      this.logger.error('Error processing PayPal webhook:', error);
      // Always return 200 to PayPal to prevent retries
      return { success: false, message: 'Error processing webhook' };
    }
  }
}
