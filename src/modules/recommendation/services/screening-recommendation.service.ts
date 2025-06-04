import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Screening } from '../../../models/screening.model';
import { Theater } from '../../../models/theater.model';
import { Movie } from '../../../models/movie.model';
import axios from 'axios';
import { Ticket } from '../../../models/ticket.model';
import { TheaterRoom } from '../../../models/theater-room.model';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class ScreeningRecommendationService {
  private readonly logger = new Logger(ScreeningRecommendationService.name);

  constructor(
    @InjectModel(Screening)
    private screeningModel: typeof Screening,
    @InjectModel(Theater)
    private theaterModel: typeof Theater,
    @InjectModel(Movie)
    private movieModel: typeof Movie,
    @InjectModel(Ticket)
    private ticketModel: typeof Ticket,
    @InjectModel(TheaterRoom)
    private theaterRoomModel: typeof TheaterRoom,
    private sequelize: Sequelize,
  ) {}

  /**
   * Gợi ý các suất chiếu phù hợp cho danh sách phim
   * Ưu tiên theo thời gian gần nhất, rạp/phòng/khung giờ user hay chọn
   */
  async getRecommendedScreenings({
    movieIds,
    userLocation,
    limit = 5,
    userId,
  }: {
    movieIds: number[];
    userLocation?: { lat: number; lng: number };
    limit?: number;
    userId?: number;
  }) {
    const now = new Date();
    // Lấy các suất chiếu sắp tới của các phim được gợi ý
    const screenings = await this.screeningModel.findAll({
      where: {
        movie_id: movieIds,
        start_time: { [Op.gte]: now },
      },
      include: [
        {
          association: 'theaterRoom',
          include: [
            {
              association: 'theater',
            },
          ],
        },
        {
          model: Movie,
          as: 'movie',
        },
      ],
      order: [['start_time', 'ASC']],
      limit: limit * movieIds.length,
    });

    // Phân tích lịch sử vé để lấy rạp/phòng/khung giờ yêu thích
    let favoriteTheaterIds: number[] = [];
    let favoriteTimeSlots: string[] = [];
    if (userId) {
      const tickets = await this.ticketModel.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Screening,
            include: [
              {
                model: TheaterRoom,
                include: [Theater],
              },
            ],
          },
        ],
      });
      // Thống kê rạp
      const theaterCount: Record<number, number> = {};
      const timeSlotCount: Record<string, number> = {};
      for (const ticket of tickets) {
        const screening = (ticket as any).screening;
        const theater = screening?.theaterRoom?.theater;
        const startTime = screening?.start_time
          ? new Date(screening.start_time)
          : null;
        if (theater?.id) {
          theaterCount[theater.id] = (theaterCount[theater.id] || 0) + 1;
        }
        if (startTime) {
          const slot = this.getTimeSlot(startTime);
          timeSlotCount[slot] = (timeSlotCount[slot] || 0) + 1;
        }
      }
      // Lấy top 2 rạp/phòng/khung giờ yêu thích
      favoriteTheaterIds = Object.entries(theaterCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([id]) => Number(id));
      favoriteTimeSlots = Object.entries(timeSlotCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([slot]) => slot);
    }

    // Nếu có vị trí user, tính khoảng cách thực tế cho từng screening
    let screeningsWithScore = await Promise.all(
      screenings.map(async (screening: any) => {
        const theater = screening.theaterRoom?.theater;
        let distance = Number.MAX_VALUE;
        if (userLocation && theater && theater.latitude && theater.longitude) {
          distance = await this.getRealDistanceORS(
            userLocation.lat,
            userLocation.lng,
            theater.latitude,
            theater.longitude,
          );
          if (typeof distance !== 'number' || isNaN(distance)) {
            distance = this.calculateDistance(
              userLocation.lat,
              userLocation.lng,
              theater.latitude,
              theater.longitude,
            );
          }
        }
        // Tính điểm ưu tiên
        let score = 0;
        // Ưu tiên rạp yêu thích
        if (favoriteTheaterIds.includes(theater?.id)) score += 2;
        // Ưu tiên khung giờ quen thuộc
        const slot = this.getTimeSlot(new Date(screening.start_time));
        if (favoriteTimeSlots.includes(slot)) score += 1;
        // Ưu tiên khoảng cách gần
        if (userLocation) score += Math.max(0, 2 - distance / 5); // càng gần càng cao, max 2 điểm
        // Ưu tiên suất chiếu sớm
        const soonScore = Math.max(
          0,
          1.5 -
            (new Date(screening.start_time).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 6),
        );
        score += soonScore;
        return { screening, score };
      }),
    );
    // Sắp xếp theo điểm ưu tiên giảm dần
    screeningsWithScore = screeningsWithScore.sort((a, b) => b.score - a.score);
    // Gom nhóm theo movie_id, lấy limit suất chiếu ưu tiên nhất cho mỗi phim
    const result: Array<{ movie_id: number; screenings: any[] }> = [];
    const movieScreeningMap = new Map<number, any[]>();
    for (const { screening } of screeningsWithScore) {
      const arr = movieScreeningMap.get(screening.movie_id) || [];
      if (arr.length < limit) {
        arr.push(screening);
        movieScreeningMap.set(screening.movie_id, arr);
      }
    }
    for (const [movieId, screenings] of movieScreeningMap.entries()) {
      result.push({
        movie_id: movieId,
        screenings,
      });
    }
    return result;
  }

  // Hàm tính khoảng cách thực tế bằng OpenRouteService, fallback sang Haversine nếu lỗi
  private async getRealDistanceORS(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): Promise<number> {
    try {
      const apiKey = process.env.ORS_API_KEY || '';
      if (!apiKey) return Number.MAX_VALUE;
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${lon1},${lat1}&end=${lon2},${lat2}`;
      const res = await axios.get(url);
      // Khoảng cách (mét)
      return res.data.features[0].properties.summary.distance / 1000; // km
    } catch (e) {
      return Number.MAX_VALUE;
    }
  }

  // Hàm tính khoảng cách đường chim bay (Haversine)
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Bán kính Trái Đất (km)
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Khoảng cách (km)
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Xác định khung giờ: sáng/chiều/tối/đêm
  private getTimeSlot(date: Date): string {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }
}
