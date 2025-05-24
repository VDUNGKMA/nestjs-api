import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Seat } from '../../models/seat.model';
import { Ticket } from '../../models/ticket.model';
import { SeatReservation } from '../../models/seat-reservation.model';
import { TheaterRoom } from '../../models/theater-room.model';
import { Op } from 'sequelize';
import { User } from '../../models/user.model';
import { TicketSeat } from '../../models/ticket-seat.model';

@Injectable()
export class SeatSuggestionService {
  constructor(
    @InjectModel(Seat) private seatModel: typeof Seat,
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
    @InjectModel(SeatReservation)
    private seatReservationModel: typeof SeatReservation,
    @InjectModel(TheaterRoom) private theaterRoomModel: typeof TheaterRoom,
    @InjectModel(User) private userModel: typeof User,
    @InjectModel(TicketSeat) private ticketSeatModel: typeof TicketSeat,
  ) {}

  /**
   * Đề xuất ghế thay thế cho người dùng khi ghế mong muốn không khả dụng
   * @param screeningId ID của suất chiếu
   * @param seatIds Danh sách ID ghế không khả dụng
   * @param count Số lượng ghế cần đề xuất
   * @param preferPairs Ưu tiên đề xuất các cặp ghế liền kề
   * @param userId ID của người dùng (nếu có) để xem xét lịch sử
   */
  async suggestAlternativeSeats(
    screeningId: number,
    seatIds: number[],
    count: number,
    preferPairs: boolean = true,
    userId?: number,
  ): Promise<{ seats: Seat[]; pairs: Seat[][] }> {
    try {
      // Lấy tất cả các ghế còn trống cho suất chiếu này
      const occupiedSeatIds = await this.getOccupiedSeatIds(screeningId);

      // Lấy thông tin về ghế đã chọn để biết vị trí
      const originalSeats = await this.seatModel.findAll({
        where: { id: seatIds },
      });

      if (originalSeats.length === 0) {
        return { seats: [], pairs: [] };
      }

      // Lấy tất cả ghế trong phòng này và sắp xếp theo hàng và số ghế
      const allSeatsInRoom = await this.seatModel.findAll({
        where: { theater_room_id: originalSeats[0].theater_room_id },
        order: [
          ['seat_row', 'ASC'],
          ['seat_number', 'ASC'],
        ],
      });

      // Lọc ra các ghế còn trống và không nằm trong danh sách ghế đang xét
      const availableSeats = allSeatsInRoom.filter(
        (seat) =>
          !occupiedSeatIds.includes(seat.id) && !seatIds.includes(seat.id),
      );

      if (availableSeats.length === 0) {
        return { seats: [], pairs: [] };
      }

      // Nếu có user_id, xem xét lịch sử đặt ghế của người dùng
      let preferredSeatTypes: string[] = [];
      let preferredRows: string[] = [];

      if (userId) {
        const userPreferences = await this.getUserSeatPreferences(userId);
        preferredSeatTypes = userPreferences.seatTypes;
        preferredRows = userPreferences.rows;
      }

      // Nếu yêu cầu ghế liền kề và có đủ số lượng ghế
      if (preferPairs && count >= 2) {
        // Tìm các cụm ghế liền kề, ưu tiên theo vị trí gần với ghế đã chọn và sở thích người dùng
        const suggestedPairs = this.findAdjacentGroups(
          availableSeats,
          count,
          originalSeats,
          preferredSeatTypes,
          preferredRows,
        );

        // Nếu tìm được cụm ghế phù hợp
        if (suggestedPairs.length > 0) {
          return {
            seats: suggestedPairs[0],
            pairs: suggestedPairs,
          };
        }
      }

      // Nếu không tìm được cụm ghế liền kề hoặc không yêu cầu ghế liền kề
      // Trả về các ghế rời có vị trí tốt nhất, ưu tiên gần vị trí ban đầu và sở thích người dùng
      const bestSeats = this.findBestAvailableSeats(
        availableSeats,
        count,
        originalSeats,
        preferredSeatTypes,
        preferredRows,
      );

      return {
        seats: bestSeats,
        pairs: [],
      };
    } catch (error) {
      console.error('Error suggesting alternative seats:', error);
      return { seats: [], pairs: [] };
    }
  }

  /**
   * Lấy danh sách ID của các ghế đã bị chiếm
   * (bao gồm cả ghế đã đặt và ghế đang giữ tạm thời)
   */
  private async getOccupiedSeatIds(screeningId: number): Promise<number[]> {
    // Lấy ID của các ghế đã được đặt vé thông qua bảng TicketSeats
    const ticketSeats = await this.ticketSeatModel.findAll({
      include: [
        {
          model: Ticket,
          attributes: ['id'],
          where: { screening_id: screeningId },
          required: true,
        },
      ],
      attributes: ['seat_id'],
    });

    const bookedSeatIds = ticketSeats.map((ticketSeat) => ticketSeat.seat_id);

    // Lấy ID của các ghế đang được giữ tạm thời và chưa hết hạn
    const reservations = await this.seatReservationModel.findAll({
      where: {
        screening_id: screeningId,
        expires_at: {
          [Op.gt]: new Date(),
        },
      },
      attributes: ['seat_id'],
    });

    const reservedSeatIds = reservations.map((res) => res.seat_id);

    // Kết hợp hai danh sách
    return [...new Set([...bookedSeatIds, ...reservedSeatIds])];
  }

  /**
   * Tìm các cụm ghế liền kề từ danh sách ghế với số lượng chỉ định
   * Ưu tiên cụm ghế ở gần vị trí ban đầu và phù hợp với sở thích người dùng
   */
  private findAdjacentGroups(
    seats: Seat[],
    groupSize: number,
    originalSeats: Seat[] = [],
    preferredSeatTypes: string[] = [],
    preferredRows: string[] = [],
  ): Seat[][] {
    const groups: Seat[][] = [];
    const seatsByRow = new Map<string, Seat[]>();

    // Nhóm ghế theo hàng
    seats.forEach((seat) => {
      const row = seat.seat_row;
      if (!seatsByRow.has(row)) {
        seatsByRow.set(row, []);
      }
      seatsByRow.get(row)?.push(seat);
    });

    // Với mỗi hàng, tìm các cụm ghế liền kề
    seatsByRow.forEach((seatsInRow) => {
      seatsInRow.sort((a, b) => a.seat_number - b.seat_number);
      for (let i = 0; i <= seatsInRow.length - groupSize; i++) {
        let isGroup = true;
        for (let j = 1; j < groupSize; j++) {
          if (
            seatsInRow[i + j].seat_number -
              seatsInRow[i + j - 1].seat_number !==
            1
          ) {
            isGroup = false;
            break;
          }
        }
        if (isGroup) {
          groups.push(seatsInRow.slice(i, i + groupSize));
        }
      }
    });

    // Nếu không có ghế ban đầu để so sánh, trả về các nhóm như đã tìm được
    if (originalSeats.length === 0) {
      return groups;
    }

    // Tính toán vị trí trung bình của ghế ban đầu
    const originalRowsSet = new Set(originalSeats.map((seat) => seat.seat_row));
    const originalRows = Array.from(originalRowsSet);
    const originalNumbers = originalSeats.map((seat) => seat.seat_number);

    const avgOriginalRow = originalRows.length === 1 ? originalRows[0] : null;
    const avgOriginalNumber =
      originalNumbers.reduce((a, b) => a + b, 0) / originalNumbers.length;

    // Sắp xếp các nhóm, ưu tiên theo:
    // 1. Cùng hàng với ghế ban đầu
    // 2. Cùng loại ghế với sở thích
    // 3. Gần vị trí ban đầu nhất
    return groups.sort((groupA, groupB) => {
      // Ưu tiên nhóm cùng hàng với ghế ban đầu
      const groupARow = groupA[0].seat_row;
      const groupBRow = groupB[0].seat_row;

      // Nếu chỉ có 1 hàng ban đầu, ưu tiên hàng đó
      if (avgOriginalRow) {
        if (groupARow === avgOriginalRow && groupBRow !== avgOriginalRow)
          return -1;
        if (groupBRow === avgOriginalRow && groupARow !== avgOriginalRow)
          return 1;
      }

      // Ưu tiên nhóm có loại ghế phù hợp với sở thích người dùng
      if (preferredSeatTypes.length > 0) {
        const groupAHasPreferredType = groupA.some((seat) =>
          preferredSeatTypes.includes(seat.seat_type),
        );
        const groupBHasPreferredType = groupB.some((seat) =>
          preferredSeatTypes.includes(seat.seat_type),
        );

        if (groupAHasPreferredType && !groupBHasPreferredType) return -1;
        if (groupBHasPreferredType && !groupAHasPreferredType) return 1;
      }

      // Ưu tiên nhóm có hàng phù hợp với sở thích người dùng
      if (preferredRows.length > 0) {
        const groupAHasPreferredRow = preferredRows.includes(groupARow);
        const groupBHasPreferredRow = preferredRows.includes(groupBRow);

        if (groupAHasPreferredRow && !groupBHasPreferredRow) return -1;
        if (groupBHasPreferredRow && !groupAHasPreferredRow) return 1;
      }

      // Ưu tiên nhóm gần vị trí ban đầu nhất
      const avgGroupANumber =
        groupA.reduce((sum, seat) => sum + seat.seat_number, 0) / groupA.length;
      const avgGroupBNumber =
        groupB.reduce((sum, seat) => sum + seat.seat_number, 0) / groupB.length;

      const distanceA = Math.abs(avgGroupANumber - avgOriginalNumber);
      const distanceB = Math.abs(avgGroupBNumber - avgOriginalNumber);

      return distanceA - distanceB;
    });
  }

  /**
   * Tìm các ghế tốt nhất từ danh sách ghế trống
   * Ưu tiên ghế gần với vị trí ban đầu và phù hợp với sở thích người dùng
   */
  private findBestAvailableSeats(
    seats: Seat[],
    count: number,
    originalSeats: Seat[] = [],
    preferredSeatTypes: string[] = [],
    preferredRows: string[] = [],
  ): Seat[] {
    // Nếu không có ghế gốc, sử dụng phương pháp cũ tìm ghế ở giữa và hàng phía sau
    if (originalSeats.length === 0) {
      return this.findCenterSeats(seats, count);
    }

    // Tính vị trí trung bình của ghế ban đầu
    const originalRowsArray = originalSeats.map((seat) => seat.seat_row);
    const originalNumbersArray = originalSeats.map((seat) => seat.seat_number);

    // Tạo một bản sao của danh sách ghế để sắp xếp
    const sortedSeats = [...seats];

    // Sắp xếp dựa trên:
    // 1. Ưu tiên ghế cùng hàng với ghế ban đầu
    // 2. Ưu tiên ghế có cùng loại ghế với sở thích người dùng
    // 3. Ưu tiên ghế gần với ghế ban đầu
    sortedSeats.sort((a, b) => {
      // Ưu tiên ghế cùng hàng với ghế ban đầu
      const aRowMatch = originalRowsArray.includes(a.seat_row);
      const bRowMatch = originalRowsArray.includes(b.seat_row);

      if (aRowMatch && !bRowMatch) return -1;
      if (bRowMatch && !aRowMatch) return 1;

      // Ưu tiên ghế cùng loại với sở thích người dùng
      if (preferredSeatTypes.length > 0) {
        const aTypeMatch = preferredSeatTypes.includes(a.seat_type);
        const bTypeMatch = preferredSeatTypes.includes(b.seat_type);

        if (aTypeMatch && !bTypeMatch) return -1;
        if (bTypeMatch && !aTypeMatch) return 1;
      }

      // Ưu tiên hàng được ưa thích
      if (preferredRows.length > 0) {
        const aRowPreferred = preferredRows.includes(a.seat_row);
        const bRowPreferred = preferredRows.includes(b.seat_row);

        if (aRowPreferred && !bRowPreferred) return -1;
        if (bRowPreferred && !aRowPreferred) return 1;
      }

      // Sắp xếp theo khoảng cách so với vị trí trung bình ban đầu
      // (ghế gần vị trí ban đầu hơn được ưu tiên)
      const closestOriginalRowIdxForA = this.findClosestIndex(
        originalRowsArray,
        a.seat_row,
      );
      const closestOriginalRowIdxForB = this.findClosestIndex(
        originalRowsArray,
        b.seat_row,
      );

      if (a.seat_row === originalRowsArray[closestOriginalRowIdxForA]) {
        // Nếu cùng hàng, so sánh số ghế
        const originalNumber = originalNumbersArray[closestOriginalRowIdxForA];
        return (
          Math.abs(a.seat_number - originalNumber) -
          Math.abs(b.seat_number - originalNumber)
        );
      }

      // Nếu khác hàng, ưu tiên hàng gần hơn
      const rowDiffA = Math.abs(
        a.seat_row.charCodeAt(0) -
          originalRowsArray[closestOriginalRowIdxForA].charCodeAt(0),
      );
      const rowDiffB = Math.abs(
        b.seat_row.charCodeAt(0) -
          originalRowsArray[closestOriginalRowIdxForB].charCodeAt(0),
      );

      return rowDiffA - rowDiffB;
    });

    return sortedSeats.slice(0, count);
  }

  /**
   * Tìm chỉ số của phần tử gần nhất trong mảng
   */
  private findClosestIndex(arr: string[], target: string): number {
    return arr.reduce((prev, curr, idx, array) => {
      return Math.abs(curr.charCodeAt(0) - target.charCodeAt(0)) <
        Math.abs(array[prev].charCodeAt(0) - target.charCodeAt(0))
        ? idx
        : prev;
    }, 0);
  }

  /**
   * Tìm ghế ở vị trí trung tâm (phương pháp cũ)
   */
  private findCenterSeats(seats: Seat[], count: number): Seat[] {
    // Nhóm ghế theo hàng
    const seatsByRow = seats.reduce(
      (acc, seat) => {
        if (!acc[seat.seat_row]) {
          acc[seat.seat_row] = [];
        }
        acc[seat.seat_row].push(seat);
        return acc;
      },
      {} as Record<string, Seat[]>,
    );

    // Sắp xếp các hàng theo thứ tự ưu tiên (từ giữa ra)
    const rows = Object.keys(seatsByRow).sort();
    const middleRowIndex = Math.floor(rows.length / 2);
    const sortedRows = rows.sort((a, b) => {
      const distanceA = Math.abs(rows.indexOf(a) - middleRowIndex);
      const distanceB = Math.abs(rows.indexOf(b) - middleRowIndex);
      return distanceA - distanceB;
    });

    // Trả về tất cả ghế trống, sắp xếp theo vị trí tốt nhất
    const allAvailableSeats: Seat[] = [];
    for (const row of sortedRows) {
      const rowSeats = seatsByRow[row];
      // Sắp xếp ghế trong hàng, ưu tiên ghế ở giữa
      const middleSeatIndex = Math.floor(rowSeats.length / 2);
      rowSeats.sort((a, b) => {
        const distanceA = Math.abs(a.seat_number - middleSeatIndex);
        const distanceB = Math.abs(b.seat_number - middleSeatIndex);
        return distanceA - distanceB;
      });

      allAvailableSeats.push(...rowSeats);
    }

    return allAvailableSeats.slice(0, count);
  }

  /**
   * Phân tích lịch sử đặt ghế của người dùng để xác định sở thích
   */
  private async getUserSeatPreferences(userId: number): Promise<{
    seatTypes: string[];
    rows: string[];
  }> {
    try {
      // Lấy vé của người dùng
      const userTickets = await this.ticketModel.findAll({
        where: {
          user_id: userId,
        },
        include: [
          {
            model: Seat,
            attributes: ['seat_row', 'seat_type', 'seat_number'],
          },
        ],
        limit: 20, // Giới hạn số lượng vé để phân tích
      });

      // Nếu không có vé, trả về danh sách rỗng
      if (userTickets.length === 0) {
        return { seatTypes: [], rows: [] };
      }

      // Đếm tần suất của từng loại ghế và hàng
      const seatTypeCount: Record<string, number> = {};
      const rowCount: Record<string, number> = {};

      userTickets.forEach((ticket) => {
        const seat = (ticket as any).seat;
        if (seat) {
          // Đếm loại ghế
          if (!seatTypeCount[seat.seat_type]) {
            seatTypeCount[seat.seat_type] = 0;
          }
          seatTypeCount[seat.seat_type]++;

          // Đếm hàng
          if (!rowCount[seat.seat_row]) {
            rowCount[seat.seat_row] = 0;
          }
          rowCount[seat.seat_row]++;
        }
      });

      // Sắp xếp loại ghế theo tần suất
      const sortedSeatTypes = Object.entries(seatTypeCount)
        .sort((a, b) => b[1] - a[1])
        .map(([type]) => type);

      // Sắp xếp hàng theo tần suất
      const sortedRows = Object.entries(rowCount)
        .sort((a, b) => b[1] - a[1])
        .map(([row]) => row);

      return {
        seatTypes: sortedSeatTypes,
        rows: sortedRows,
      };
    } catch (error) {
      console.error('Error getting user seat preferences:', error);
      return { seatTypes: [], rows: [] };
    }
  }
}
