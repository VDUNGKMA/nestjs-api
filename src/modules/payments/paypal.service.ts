import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import * as querystring from 'querystring';
import { ModuleRef } from '@nestjs/core';
import { PaymentService } from './payments.service';
import * as crypto from 'crypto';

@Injectable()
export class PayPalService {
  private readonly logger = new Logger('PayPalService');

  // PayPal Sandbox Credentials
  private readonly clientId =
    'AdWYPwEyajhsZTid5wSawW-YZInwEHi8cWy2GRUG1zCxfOpSaGV7KrAVbQ-N1-RG0b-oD2gnpgd5zMEs'; // Replace with your PayPal sandbox client ID
  private readonly clientSecret =
    'ECXLbxH1h045P-6GvgHrJRGMX3nKUiLOKIhXJ6uptIQeWiSn_rrYH4n7aEG_DW8fHchO7pN76DrNHVVn'; // Replace with your PayPal sandbox client secret
  private readonly baseUrl = 'https://api-m.sandbox.paypal.com'; // Sandbox URL (use https://api-m.paypal.com for production)

  // Add your webhook ID here (you'll get this when creating a webhook in PayPal Developer Dashboard)
  private readonly webhookId = 'YOUR_WEBHOOK_ID'; // Replace with your actual webhook ID

  constructor(private readonly moduleRef: ModuleRef) {
    this.logger.log('PayPalService initialized');
  }

  // Get OAuth access token from PayPal
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64');

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/v1/oauth2/token`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        data: 'grant_type=client_credentials',
      });

      return response.data.access_token;
    } catch (error) {
      this.logger.error('Error getting PayPal access token:', error);
      throw new HttpException(
        'Failed to connect to PayPal',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // Create a PayPal order
  async createOrder(
    amount: number,
    currency: string = 'USD',
    description: string,
    returnUrl?: string,
    cancelUrl?: string,
    customId?: string,
  ): Promise<any> {
    try {
      if (currency !== 'USD') {
        throw new Error(
          'PayPal chỉ hỗ trợ thanh toán bằng USD. Vui lòng chuyển đổi số tiền sang USD trước khi tạo đơn hàng.',
        );
      }
      const accessToken = await this.getAccessToken();

      // Use provided URLs or defaults that will work with mobile apps
      const finalReturnUrl = returnUrl || 'https://example.com/payment/success';
      const finalCancelUrl = cancelUrl || 'https://example.com/payment/cancel';

      const payload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toString(),
            },
            description: description,
            // Add custom ID to track payment in webhooks
            custom_id: customId || description,
          },
        ],
        application_context: {
          return_url: finalReturnUrl,
          cancel_url: finalCancelUrl,
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/v2/checkout/orders`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        data: payload,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error creating PayPal order:', error);
      throw new HttpException(
        error.response?.data?.message || 'Failed to create PayPal order',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Capture payment for an approved PayPal order
  async capturePayment(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error capturing PayPal payment:', error);
      throw new HttpException(
        error.response?.data?.message || 'Failed to capture PayPal payment',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Get details of a PayPal order
  async getOrderDetails(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios({
        method: 'get',
        url: `${this.baseUrl}/v2/checkout/orders/${orderId}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting PayPal order details:', error);
      throw new HttpException(
        error.response?.data?.message || 'Failed to get PayPal order details',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Verify the authenticity of a PayPal webhook
   * @param webhookVerificationData The data to verify the webhook
   * @returns boolean indicating if the webhook is authentic
   */
  async verifyWebhookSignature(webhookVerificationData: {
    authAlgo: string;
    certUrl: string;
    transmissionId: string;
    transmissionSig: string;
    transmissionTime: string;
    webhookEvent: string;
  }): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      const verificationData = {
        auth_algo: webhookVerificationData.authAlgo,
        cert_url: webhookVerificationData.certUrl,
        transmission_id: webhookVerificationData.transmissionId,
        transmission_sig: webhookVerificationData.transmissionSig,
        transmission_time: webhookVerificationData.transmissionTime,
        webhook_id: this.webhookId,
        webhook_event:
          typeof webhookVerificationData.webhookEvent === 'string'
            ? JSON.parse(webhookVerificationData.webhookEvent)
            : webhookVerificationData.webhookEvent,
      };

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        data: verificationData,
      });

      return response.data.verification_status === 'SUCCESS';
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  // Thêm phương thức xử lý webhook từ PayPal
  async handlePayPalWebhook(payload: any): Promise<any> {
    try {
      const { event_type, resource } = payload;
      this.logger.log(`Processing PayPal webhook: ${event_type}`);

      // Handle different PayPal event types
      switch (event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          return this.handlePaymentCaptureCompleted(resource);

        case 'CHECKOUT.ORDER.APPROVED':
          return this.handleOrderApproved(resource);

        case 'CHECKOUT.ORDER.COMPLETED':
          return this.handleOrderCompleted(resource);

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.REFUNDED':
        case 'PAYMENT.CAPTURE.REVERSED':
          return this.handlePaymentFailed(resource);

        default:
          this.logger.log(`Unhandled PayPal webhook event: ${event_type}`);
          return {
            success: true,
            message: 'Webhook received but not processed',
          };
      }
    } catch (error) {
      this.logger.error('Error handling PayPal webhook:', error);
      return { success: false, message: 'Error processing webhook' };
    }
  }

  // Handle completed payment capture
  private async handlePaymentCaptureCompleted(resource: any): Promise<any> {
    try {
      const { id, status, custom_id, amount } = resource;

      if (status === 'COMPLETED') {
        // Try to extract ticket info from the custom ID or from supplementary data
        let ticketIds: number[] = [];
        let userId: number | null = null;
        let paymentAmount: number = amount?.value
          ? parseFloat(amount.value)
          : 0;

        try {
          // First try to parse the custom_id
          if (custom_id) {
            const parsedData = JSON.parse(custom_id);
            ticketIds = parsedData.ticketIds || [];
            userId = parsedData.userId || null;
            paymentAmount = parsedData.amount || paymentAmount;
          }

          // If we have enough information, process the payment
          if (ticketIds.length > 0 && userId) {
            await this.processSuccessfulPayment(
              ticketIds,
              userId,
              paymentAmount,
              id,
            );
            return { success: true, message: 'Payment processed successfully' };
          } else {
            // If we can't get ticket info from custom_id, try to get from order details
            // This would require looking up the order using the payment info
            this.logger.warn(
              `Payment completed but insufficient info in custom_id: ${custom_id}`,
            );
            return {
              success: true,
              message: 'Payment completed but no ticket info provided',
            };
          }
        } catch (parseError) {
          this.logger.error('Error parsing payment data:', parseError);
          return { success: false, message: 'Error parsing payment data' };
        }
      }

      return { success: true, message: `Payment status: ${status}` };
    } catch (error) {
      this.logger.error('Error handling payment capture completed:', error);
      return { success: false, message: 'Error processing payment capture' };
    }
  }

  // Handle approved order
  private async handleOrderApproved(resource: any): Promise<any> {
    this.logger.log(`Order approved: ${resource.id}`);
    // Order is approved but not captured yet
    return { success: true, message: 'Order approved' };
  }

  // Handle completed order
  private async handleOrderCompleted(resource: any): Promise<any> {
    this.logger.log(`Order completed: ${resource.id}`);

    // Extract payment details from order
    const purchaseUnits = resource.purchase_units || [];

    if (purchaseUnits.length > 0) {
      const unit = purchaseUnits[0];
      const payments = unit.payments || {};
      const captures = payments.captures || [];

      if (captures.length > 0) {
        // Process each capture
        for (const capture of captures) {
          await this.handlePaymentCaptureCompleted(capture);
        }
      }
    }

    return { success: true, message: 'Order completed' };
  }

  // Handle failed payment
  private async handlePaymentFailed(resource: any): Promise<any> {
    this.logger.warn(
      `Payment failed or reversed: ${resource.id}, status: ${resource.status}`,
    );

    // Update payment record to failed if we can identify the transaction
    // Would need to implement this later

    return { success: true, message: 'Payment failure recorded' };
  }

  // Phương thức xử lý khi thanh toán thành công
  private async processSuccessfulPayment(
    ticketIds: number[],
    userId: number,
    amount: number,
    transactionId: string,
  ): Promise<void> {
    try {
      // Tìm dịch vụ từ container để tránh circular dependency
      const paymentService = this.moduleRef.get(PaymentService, {
        strict: false,
      });

      // Kiểm tra xem transaction_id đã tồn tại chưa
      try {
        // Tìm thanh toán với transaction_id tương tự
        const payments =
          await paymentService.findByTransactionId(transactionId);

        if (payments && payments.length > 0) {
          this.logger.warn(
            `Transaction ${transactionId} đã được xử lý trước đó. Bỏ qua.`,
          );
          return;
        }
      } catch (checkError) {
        this.logger.error(
          'Lỗi khi kiểm tra transaction_id tồn tại:',
          checkError,
        );
        // Tiếp tục xử lý ngay cả khi kiểm tra có lỗi
      }

      // Tạo payment cho tất cả các vé trong một giao dịch
      // Mỗi vé sẽ có cùng transaction_id
      for (const ticketId of ticketIds) {
        try {
          await paymentService.create({
            ticket_id: ticketId,
            user_id: userId,
            amount: amount / ticketIds.length,
            payment_method: 'PayPal',
            payment_status: 'completed',
            transaction_id: transactionId, // Giữ nguyên transaction_id cho tất cả vé
          });
        } catch (error) {
          // Log lỗi cho vé cụ thể nhưng vẫn tiếp tục xử lý các vé khác
          this.logger.error(
            `Lỗi khi xử lý thanh toán cho vé ${ticketId}:`,
            error,
          );

          // Kiểm tra nếu lỗi là do transactionId đã tồn tại, coi như vé đã được thanh toán
          if (error?.message?.includes('đã tồn tại')) {
            this.logger.log(
              `Vé ${ticketId} có thể đã được thanh toán trước đó với giao dịch ${transactionId}`,
            );
          }
        }
      }

      // Gửi thông báo đến user (có thể triển khai sau với socket hoặc push notification)
      this.logger.log(`Payment completed for tickets: ${ticketIds.join(', ')}`);
    } catch (error) {
      this.logger.error('Error processing PayPal payment:', error);
      // Ghi log lỗi để xử lý thủ công sau
      // Có thể thêm retry mechanism hoặc queue để đảm bảo việc xử lý không bị mất
    }
  }
}
