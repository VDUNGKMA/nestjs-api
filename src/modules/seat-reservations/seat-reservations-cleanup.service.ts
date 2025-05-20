import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SeatReservationService } from './seat-reservations.service';

@Injectable()
export class SeatReservationsCleanupService implements OnModuleInit {
  private readonly logger = new Logger(SeatReservationsCleanupService.name);
  private readonly CLEANUP_INTERVAL = 60000; // Chạy mỗi 60 giây

  constructor(
    private readonly seatReservationService: SeatReservationService,
  ) {}

  onModuleInit() {
    // Bắt đầu chu trình dọn dẹp khi ứng dụng khởi động
    this.scheduleCleanup();
  }

  private scheduleCleanup() {
    setTimeout(async () => {
      await this.cleanupExpiredReservations();
      this.scheduleCleanup(); // Lên lịch cho lần tiếp theo
    }, this.CLEANUP_INTERVAL);
  }

  private async cleanupExpiredReservations() {
    this.logger.debug('Đang dọn dẹp các đặt chỗ tạm thời đã hết hạn...');
    try {
      const count =
        await this.seatReservationService.cleanupExpiredReservations();
      if (count > 0) {
        this.logger.log(`Đã xóa ${count} đặt chỗ tạm thời hết hạn`);
      }
    } catch (error) {
      this.logger.error(`Lỗi khi dọn dẹp đặt chỗ tạm thời: ${error.message}`);
    }
  }
}
