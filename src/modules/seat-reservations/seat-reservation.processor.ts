import { Processor, Process } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { SeatReservationService } from './seat-reservations.service';
import { InjectModel } from '@nestjs/sequelize';
import { SeatReservation } from '../../models/seat-reservation.model';
import { Sequelize } from 'sequelize-typescript';
import { SeatReservationGateway } from './seat-reservation.gateway';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RedisLockService } from './redis-lock.service';
import { v4 as uuidv4 } from 'uuid';
import { ReservationType } from './dto/create-seat-reservation.dto';

// Define job types for better type safety
export interface ReserveSeatJob {
  user_id: number;
  screening_id: number;
  seat_ids: number[];
  reservation_type: ReservationType;
  suggest_alternatives?: boolean;
  require_all?: boolean;
  request_timestamp: number;
  request_id: string;
}

export interface ReleaseSeatsJob {
  user_id: number;
  screening_id: number;
  seat_ids: number[];
  request_id: string;
}

export interface UpdateReservationTypeJob {
  user_id: number;
  screening_id: number;
  seat_ids: number[];
  new_type: ReservationType;
  request_id: string;
}

@Processor('seat-reservations')
export class SeatReservationProcessor {
  private readonly logger = new Logger(SeatReservationProcessor.name);

  // Keeps track of the number of pending jobs per screening
  private screeningPendingJobs: Map<number, number> = new Map();

  constructor(
    private seatReservationService: SeatReservationService,
    private redisLockService: RedisLockService,
    @InjectModel(SeatReservation)
    private seatReservationModel: typeof SeatReservation,
    private sequelize: Sequelize,
    private seatReservationGateway: SeatReservationGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Process('reserve-seat')
  async processReserveSeat(job: Job<ReserveSeatJob>) {
    const {
      user_id,
      screening_id,
      seat_ids,
      reservation_type,
      suggest_alternatives,
      require_all,
      request_id,
    } = job.data;

    this.logger.log(
      `Processing seat reservation: Screening #${screening_id}, Seats: ${seat_ids.join(
        ', ',
      )}, User: ${user_id}, request_id: ${request_id}`,
    );

    // Increment pending jobs counter for this screening
    this.updatePendingJobsCount(screening_id, 1);

    try {
      // Try to acquire a distributed lock for all requested seats
      const lockKey = this.getSeatLockKey(screening_id, seat_ids);
      const lockAcquired = await this.redisLockService.acquireLock(
        lockKey,
        30000, // 30 seconds timeout
      );

      if (!lockAcquired) {
        this.logger.warn(
          `Could not acquire lock for seats: ${seat_ids.join(', ')} in screening #${screening_id}`,
        );

        // Return a conflict result
        return {
          success: false,
          error: 'Đang có người khác đặt ghế này, vui lòng thử lại.',
        };
      }

      // Process the reservation with the actual service
      const result = await this.seatReservationService.createReservations({
        user_id,
        screening_id,
        seat_ids,
        reservation_type,
        suggest_alternatives,
        require_all,
      });

      // Release the lock after processing
      await this.redisLockService.releaseLock(lockKey);

      // If successful, notify connected clients about the seat status change
      if (
        result.success &&
        result.reservations &&
        result.reservations.length > 0
      ) {
        this.seatReservationGateway.notifySeatReserved(
          screening_id,
          seat_ids,
          user_id,
        );

        // Cache reservation results
        const cacheKey = `reservation:${user_id}:${screening_id}`;
        await this.cacheManager.set(cacheKey, result, 600000); // 10 minutes TTL
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error processing seat reservation: ${error.message}`,
        error.stack,
      );

      // Make sure to release the lock in case of errors
      const lockKey = this.getSeatLockKey(screening_id, seat_ids);
      await this.redisLockService.releaseLock(lockKey);

      return {
        success: false,
        error: `Server error: ${error.message}`,
      };
    } finally {
      // Decrement pending jobs counter
      this.updatePendingJobsCount(screening_id, -1);
    }
  }

  @Process('release-seats')
  async processReleaseSeats(job: Job<ReleaseSeatsJob>) {
    const { user_id, screening_id, seat_ids, request_id } = job.data;

    this.logger.log(
      `Processing seat release: Screening #${screening_id}, Seats: ${seat_ids.join(
        ', ',
      )}, User: ${user_id}`,
    );

    try {
      // Try to acquire a distributed lock for all requested seats
      const lockKey = this.getSeatLockKey(screening_id, seat_ids);
      const lockAcquired = await this.redisLockService.acquireLock(
        lockKey,
        30000, // 30 seconds timeout
      );

      if (!lockAcquired) {
        this.logger.warn(
          `Could not acquire lock for releasing seats: ${seat_ids.join(
            ', ',
          )} in screening #${screening_id}`,
        );
        return {
          success: false,
          error: 'Không thể giải phóng ghế, vui lòng thử lại.',
        };
      }

      // Use a transaction to ensure consistency
      const transaction = await this.sequelize.transaction();

      try {
        // Find and delete all reservations for the user, screening, and seats
        const reservations = await this.seatReservationModel.findAll({
          where: {
            user_id,
            screening_id,
            seat_id: seat_ids,
          },
          transaction,
        });

        if (reservations.length === 0) {
          await transaction.rollback();

          // Release the lock
          await this.redisLockService.releaseLock(lockKey);

          return {
            success: false,
            error: 'Không tìm thấy đặt chỗ để giải phóng.',
          };
        }

        // Delete all found reservations
        await Promise.all(
          reservations.map((reservation) =>
            reservation.destroy({ transaction }),
          ),
        );

        // Commit transaction
        await transaction.commit();

        // Notify clients about the seat release
        this.seatReservationGateway.notifySeatReleased(screening_id, seat_ids);

        // Invalidate cache
        const cacheKey = `reservation:${user_id}:${screening_id}`;
        await this.cacheManager.del(cacheKey);

        // Release the lock
        await this.redisLockService.releaseLock(lockKey);

        return {
          success: true,
          message: 'Đã giải phóng ghế thành công.',
        };
      } catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error releasing seats: ${error.message}`, error.stack);

      // Make sure to release the lock in case of errors
      const lockKey = this.getSeatLockKey(screening_id, seat_ids);
      await this.redisLockService.releaseLock(lockKey);

      return {
        success: false,
        error: `Server error: ${error.message}`,
      };
    }
  }

  @Process('update-reservation-type')
  async processUpdateReservationType(job: Job<UpdateReservationTypeJob>) {
    const { user_id, screening_id, seat_ids, new_type, request_id } = job.data;

    this.logger.log(
      `Updating reservation type: Screening #${screening_id}, Seats: ${seat_ids.join(
        ', ',
      )}, User: ${user_id}, New Type: ${new_type}`,
    );

    try {
      await this.seatReservationService.updateReservationType(
        user_id,
        screening_id,
        seat_ids,
        new_type,
      );

      return {
        success: true,
        message: 'Đã cập nhật loại đặt chỗ thành công.',
      };
    } catch (error) {
      this.logger.error(
        `Error updating reservation type: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: `Server error: ${error.message}`,
      };
    }
  }

  /**
   * Generates a unique key for locking seats in a specific screening
   */
  private getSeatLockKey(screeningId: number, seatIds: number[]): string {
    return `screening:${screeningId}:seats:${seatIds.sort().join(',')}`;
  }

  /**
   * Update the counter of pending jobs for a screening
   */
  private updatePendingJobsCount(screeningId: number, delta: number): void {
    const currentCount = this.screeningPendingJobs.get(screeningId) || 0;
    const newCount = currentCount + delta;

    if (newCount <= 0) {
      this.screeningPendingJobs.delete(screeningId);
    } else {
      this.screeningPendingJobs.set(screeningId, newCount);
    }
  }

  /**
   * Get the number of pending jobs for a screening
   */
  getPendingJobsCount(screeningId: number): number {
    return this.screeningPendingJobs.get(screeningId) || 0;
  }
}
