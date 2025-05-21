import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SeatReservation } from '../../models/seat-reservation.model';
import {
  CreateSeatReservationDto,
  ReservationType,
} from './dto/create-seat-reservation.dto';
import { User } from '../../models/user.model';
import { Screening } from '../../models/screening.model';
import { Seat } from '../../models/seat.model';
import { Ticket } from '../../models/ticket.model';
import { Sequelize } from 'sequelize-typescript';
import { addMinutes } from 'date-fns';
import { Transaction } from 'sequelize';
import { SeatSuggestionService } from './seat-suggestion.service';
import { RedisLockService } from './redis-lock.service';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

// Export interface để có thể sử dụng trong controller
export interface ReservationResult {
  success: boolean;
  reservations?: SeatReservation[];
  unavailableSeats?: number[];
  alternativeSuggestions?: {
    seats: Seat[];
    pairs: Seat[][];
  };
  error?: string;
  reservationId?: string;
  expiresAt?: string;
}

@Injectable()
export class SeatReservationService {
  constructor(
    @InjectModel(SeatReservation)
    private seatReservationModel: typeof SeatReservation,
    @InjectModel(User) private userModel: typeof User,
    @InjectModel(Screening) private screeningModel: typeof Screening,
    @InjectModel(Seat) private seatModel: typeof Seat,
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
    private sequelize: Sequelize,
    private seatSuggestionService: SeatSuggestionService,
    private redisLockService: RedisLockService,
  ) {}

  async createReservations(
    createSeatReservationDto: CreateSeatReservationDto,
  ): Promise<ReservationResult> {
    const {
      user_id,
      screening_id,
      seat_ids,
      reservation_type,
      suggest_alternatives = true,
      require_all = false,
    } = createSeatReservationDto;

    // Kiểm tra xem suất chiếu có tồn tại không
    const screening = await this.screeningModel.findByPk(screening_id);
    if (!screening) {
      throw new NotFoundException(
        `Không tìm thấy suất chiếu ID: ${screening_id}`,
      );
    }

    // Tạo khóa duy nhất cho mỗi ghế trong suất chiếu này
    const lockKeys = seat_ids.map(
      (seatId) => `screening:${screening_id}:seat:${seatId}`,
    );

    try {
      // Cố gắng khóa tất cả các ghế cùng lúc
      const acquired = await Promise.all(
        lockKeys.map((key) => this.redisLockService.acquireLock(key, 5000)), // 5 giây timeout
      );

      // Nếu không thể khóa tất cả các ghế
      if (acquired.some((result) => !result)) {
        // Giải phóng các khóa đã acquire được
        await Promise.all(
          lockKeys.map((key) => this.redisLockService.releaseLock(key)),
        );

        // Kiểm tra ghế còn trống và đề xuất ghế thay thế
        const availableSeats = await this.getAvailableSeats(screening_id);
        if (suggest_alternatives && availableSeats.length > 0) {
          const suggestions =
            await this.seatSuggestionService.suggestAlternativeSeats(
              screening_id,
              seat_ids,
              seat_ids.length,
              true,
              user_id,
            );

          if (suggestions.seats.length > 0 || suggestions.pairs.length > 0) {
            return {
              success: false,
              error:
                'Đang có người khác đặt ghế này. Vui lòng xem các ghế được đề xuất bên dưới.',
              unavailableSeats: seat_ids,
              alternativeSuggestions: suggestions,
            };
          }
        }

        throw new ConflictException(
          'Đang có người khác đặt ghế này, vui lòng thử lại.',
        );
      }

      const transaction = await this.sequelize.transaction();

      try {
        // Kiểm tra xem có ghế nào đã được đặt chưa
        const existingReservations = await this.seatReservationModel.findAll({
          where: {
            screening_id,
            seat_id: seat_ids,
            expires_at: {
              [Op.gt]: new Date(),
            },
          },
          transaction,
        });

        if (existingReservations.length > 0) {
          const unavailableSeats = existingReservations.map((r) => r.seat_id);

          // Nếu yêu cầu tất cả các ghế phải khả dụng hoặc tất cả ghế đều không khả dụng
          if (require_all || unavailableSeats.length === seat_ids.length) {
            // Kiểm tra ghế còn trống và đề xuất ghế thay thế
            const availableSeats = await this.getAvailableSeats(screening_id);
            if (suggest_alternatives && availableSeats.length > 0) {
              const suggestions =
                await this.seatSuggestionService.suggestAlternativeSeats(
                  screening_id,
                  seat_ids,
                  seat_ids.length,
                  true,
                  user_id,
                );

              if (
                suggestions.seats.length > 0 ||
                suggestions.pairs.length > 0
              ) {
                return {
                  success: false,
                  error:
                    'Ghế bạn chọn đã được đặt. Vui lòng xem các ghế được đề xuất bên dưới.',
                  unavailableSeats,
                  alternativeSuggestions: suggestions,
                };
              }
            }

            throw new ConflictException(
              'Ghế đã được đặt, vui lòng chọn ghế khác.',
            );
          }

          // Lọc ra các ghế còn trống
          const availableSeats = seat_ids.filter(
            (id) => !unavailableSeats.includes(id),
          );

          // Tạo một reservation_id chung cho nhóm ghế này
          const reservationId = uuidv4();
          const expiresAt = this.getExpirationTime(reservation_type);

          // Tạo đặt chỗ cho các ghế còn trống
          const reservations = await Promise.all(
            availableSeats.map((seatId) =>
              this.seatReservationModel.create(
                {
                  user_id,
                  screening_id,
                  seat_id: seatId,
                  expires_at: expiresAt,
                  reservation_type,
                  reservation_id: reservationId,
                },
                { transaction },
              ),
            ),
          );

          await transaction.commit();

          // Đề xuất ghế thay thế cho các ghế không khả dụng
          if (suggest_alternatives) {
            const suggestions =
              await this.seatSuggestionService.suggestAlternativeSeats(
                screening_id,
                unavailableSeats,
                unavailableSeats.length,
                true,
                user_id,
              );

            return {
              success: true,
              reservations,
              unavailableSeats,
              alternativeSuggestions: suggestions,
              reservationId,
              expiresAt: expiresAt.toISOString(),
            };
          }

          return {
            success: true,
            reservations,
            unavailableSeats,
            reservationId,
            expiresAt: expiresAt.toISOString(),
          };
        }

        // Tạo một reservation_id chung cho tất cả ghế
        const reservationId = uuidv4();
        const expiresAt = this.getExpirationTime(reservation_type);

        // Tạo đặt chỗ cho tất cả các ghế
        const reservations = await Promise.all(
          seat_ids.map((seatId) =>
            this.seatReservationModel.create(
              {
                user_id,
                screening_id,
                seat_id: seatId,
                expires_at: expiresAt,
                reservation_type,
                reservation_id: reservationId,
              },
              { transaction },
            ),
          ),
        );

        await transaction.commit();

        return {
          success: true,
          reservations,
          reservationId,
          expiresAt: expiresAt.toISOString(),
        };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      // Giải phóng tất cả các khóa
      await Promise.all(
        lockKeys.map((key) => this.redisLockService.releaseLock(key)),
      );

      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        // Kiểm tra ghế còn trống và đề xuất ghế thay thế
        const availableSeats = await this.getAvailableSeats(screening_id);
        if (suggest_alternatives && availableSeats.length > 0) {
          const suggestions =
            await this.seatSuggestionService.suggestAlternativeSeats(
              screening_id,
              seat_ids,
              seat_ids.length,
              true,
              user_id,
            );

          // Luôn trả về thông tin về ghế trống, ngay cả khi không tìm được cặp ghế liền kề
          return {
            success: false,
            error:
              'Ghế bạn chọn đã được đặt. Vui lòng xem các ghế còn trống bên dưới.',
            unavailableSeats: seat_ids,
            alternativeSuggestions: {
              seats: availableSeats,
              pairs: suggestions.pairs || [],
            },
          };
        }
        throw error;
      }
      throw new BadRequestException('Không thể đặt ghế. Vui lòng thử lại sau.');
    }
  }

  // Xóa đặt chỗ tạm thời của một người dùng
  async removeUserReservations(
    userId: number,
    screeningId: number,
  ): Promise<void> {
    await this.seatReservationModel.destroy({
      where: {
        user_id: userId,
        screening_id: screeningId,
      },
    });
  }

  // Cập nhật loại đặt chỗ (ví dụ: từ temporary sang processing_payment)
  async updateReservationType(
    userId: number,
    screeningId: number,
    seatIds: number[],
    newType: ReservationType,
  ): Promise<void> {
    const transaction = await this.sequelize.transaction();

    try {
      for (const seatId of seatIds) {
        const reservation = await this.seatReservationModel.findOne({
          where: {
            user_id: userId,
            screening_id: screeningId,
            seat_id: seatId,
          },
          transaction,
        });

        if (!reservation) {
          throw new NotFoundException(
            `Không tìm thấy đặt chỗ tạm thời cho ghế ID: ${seatId}`,
          );
        }

        // Cập nhật loại và thời gian hết hạn
        await reservation.update(
          {
            reservation_type: newType,
            expires_at: this.getExpirationTime(newType),
          },
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Kiểm tra xem ghế còn trống không
  async isSeatAvailable(screeningId: number, seatId: number): Promise<boolean> {
    // Kiểm tra trong bảng vé
    const existingTicket = await this.ticketModel.findOne({
      where: {
        screening_id: screeningId,
        seat_id: seatId,
      },
    });

    if (existingTicket) {
      return false;
    }

    // Kiểm tra trong bảng đặt chỗ tạm thời
    const existingReservation = await this.seatReservationModel.findOne({
      where: {
        screening_id: screeningId,
        seat_id: seatId,
      },
    });

    if (
      existingReservation &&
      new Date(existingReservation.expires_at) > new Date()
    ) {
      return false;
    }

    return true;
  }

  // Dọn dẹp các đặt chỗ tạm thời đã hết hạn
  async cleanupExpiredReservations(): Promise<number> {
    const result = await this.seatReservationModel.destroy({
      where: {
        expires_at: {
          [Symbol.for('lt')]: new Date(),
        },
      },
    });
    return result;
  }

  // Lấy danh sách ghế đã đặt tạm thời của người dùng
  async getUserReservations(
    userId: number,
    screeningId: number,
  ): Promise<SeatReservation[]> {
    return this.seatReservationModel.findAll({
      where: {
        user_id: userId,
        screening_id: screeningId,
      },
      include: [Seat],
    });
  }

  // Kiểm tra và lấy tất cả các ghế trống cho suất chiếu
  async getAvailableSeats(screeningId: number): Promise<Seat[]> {
    // Lấy thông tin về suất chiếu để biết phòng chiếu
    const screening = await this.screeningModel.findByPk(screeningId);

    if (!screening) {
      throw new NotFoundException(
        `Không tìm thấy suất chiếu ID: ${screeningId}`,
      );
    }

    // Lấy tất cả ghế trong phòng chiếu
    const allSeats = await this.seatModel.findAll({
      where: { theater_room_id: screening.theater_room_id },
    });

    // Lấy danh sách ghế đã đặt
    const bookedTickets = await this.ticketModel.findAll({
      where: { screening_id: screeningId },
      attributes: ['seat_id'],
    });

    const bookedSeatIds = new Set(
      bookedTickets.map((ticket) => ticket.seat_id),
    );

    // Lấy danh sách ghế đang giữ tạm thời và chưa hết hạn
    const reservations = await this.seatReservationModel.findAll({
      where: {
        screening_id: screeningId,
        expires_at: {
          [Symbol.for('gt')]: new Date(),
        },
      },
      attributes: ['seat_id'],
    });

    const reservedSeatIds = new Set(reservations.map((res) => res.seat_id));

    // Lọc ra các ghế còn trống
    return allSeats.filter(
      (seat) => !bookedSeatIds.has(seat.id) && !reservedSeatIds.has(seat.id),
    );
  }

  // Phương thức hỗ trợ để tính thời gian hết hạn
  private getExpirationTime(reservationType: ReservationType): Date {
    const now = new Date();
    return reservationType === ReservationType.TEMPORARY
      ? addMinutes(now, 10) // Tạm thời: 10 phút
      : addMinutes(now, 60); // Đang thanh toán: 60 phút (tăng từ 30 phút)
  }

  /**
   * Hủy đặt chỗ theo reservationId
   */
  async cancelReservation(
    reservationId: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Xóa tất cả reservation với reservationId tương ứng
      const deletedCount = await this.seatReservationModel.destroy({
        where: { reservation_id: reservationId },
      });

      if (deletedCount > 0) {
        return { success: true, message: 'Đã hủy đặt chỗ thành công' };
      } else {
        return { success: false, message: 'Không tìm thấy đặt chỗ với mã này' };
      }
    } catch (error) {
      console.error('Error canceling reservation:', error);
      return { success: false, message: 'Có lỗi xảy ra khi hủy đặt chỗ' };
    }
  }
}
