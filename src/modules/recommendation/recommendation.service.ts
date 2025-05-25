import { Injectable } from '@nestjs/common';
import { MoviesService } from '../movies/movie.service';
import { TicketService } from '../tickets/tickets.service';
import * as natural from 'natural';
import * as _ from 'lodash';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly moviesService: MoviesService,
    private readonly ticketService: TicketService,
  ) {}

  // Hàm gợi ý phim cho user dựa trên content-based filtering, tối ưu hóa hybrid score
  async recommendForUser(userId: number, topN = 5) {
    // 1. Lấy lịch sử vé của user
    const tickets = await this.ticketService.findByUserId(userId);
    const watchedMovieIds = _(tickets)
      .map((t) => t.screening?.movie?.id)
      .filter(Boolean)
      .uniq()
      .value();
    console.log('watchedMovieIds:', watchedMovieIds);

    // 2. Lấy toàn bộ phim
    const allMovies = await this.moviesService.findAll({});
    console.log('allMovies.length:', allMovies.length);

    // 3. Lấy tất cả genreId của phim đã xem
    const watchedGenres = _.uniq(
      watchedMovieIds
        .map((id) => allMovies.find((m) => m.id === id))
        .flatMap((m) => m?.genres?.map((g) => g.id) || []),
    );
    console.log('watchedGenres:', watchedGenres);

    // 4. Lọc phim chưa xem cùng thể loại
    let candidateMovies = allMovies.filter(
      (m) =>
        !watchedMovieIds.includes(m.id) &&
        m.genres?.some((g) => watchedGenres.includes(g.id)),
    );
    console.log(
      'candidateMovies (same genre):',
      candidateMovies.map((m) => m.id),
    );
    if (candidateMovies.length === 0) {
      candidateMovies = allMovies.filter(
        (m) => !watchedMovieIds.includes(m.id),
      );
      console.log('Fallback to allMovies (no same genre)');
    }

    // 5. Gộp nội dung phim thành chuỗi
    const movieContents = allMovies.map((m) => {
      const genres = m.genres ? m.genres.map((g) => g.name).join(' ') : '';
      return [m.title, m.description, m.director, m.cast, genres]
        .filter(Boolean)
        .join(' ');
    });

    // 6. Vector hóa TF-IDF
    const tfidf = new natural.TfIdf();
    movieContents.forEach((doc) => tfidf.addDocument(doc));
    // Lấy vector TF-IDF cho từng phim
    const vectors = movieContents.map((_, idx) => {
      const obj: Record<string, number> = {};
      tfidf.listTerms(idx).forEach((term) => {
        obj[term.term] = term.tfidf;
      });
      return obj;
    });
    // Hàm tính cosine similarity
    function cosineSim(
      vecA: Record<string, number>,
      vecB: Record<string, number>,
    ) {
      const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
      const a = Array.from(allTerms).map((term) => vecA[term] || 0);
      const b = Array.from(allTerms).map((term) => vecB[term] || 0);
      const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
      const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
      const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
      return normA && normB ? dot / (normA * normB) : 0;
    }

    // 7. Tính similarity giữa các phim user đã xem và các phim còn lại
    const watchedIndices = watchedMovieIds
      .map((id) => allMovies.findIndex((m) => m.id === id))
      .filter((idx) => idx !== -1);
    console.log('watchedIndices:', watchedIndices);

    // Nếu user chưa xem phim nào, trả về phim mới ra mắt nhất (chỉ lấy phim chưa xem)
    if (watchedIndices.length === 0) {
      const result = _.orderBy(
        candidateMovies,
        ['release_date'],
        ['desc'],
      ).slice(0, topN);
      console.log(
        'No watched movies, recommend by release_date:',
        result.map((m) => m.id),
      );
      return result.map((m) => ({
        ...m,
        similarity: null,
        reason: 'Phim mới ra mắt, cùng thể loại bạn quan tâm',
      }));
    }

    // Tính similarity cho từng phim ứng viên
    const candidateIndices = candidateMovies.map((m) =>
      allMovies.findIndex((x) => x.id === m.id),
    );
    const watchedVectors = watchedIndices.map((idx) => vectors[idx]);
    const scores = candidateIndices.map((idx) => {
      const vec = vectors[idx];
      const simArr = watchedVectors.map((wv) => cosineSim(wv, vec));
      return _.mean(simArr);
    });
    console.log('candidateIndices:', candidateIndices);
    console.log('scores:', scores);

    // Chuẩn hóa các trường popularity, rating, release_date về 0-1
    function normalize(arr: (number | null | undefined)[]) {
      const valid = arr.filter((x) => typeof x === 'number') as number[];
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      return arr.map((x) =>
        typeof x === 'number' && max > min ? (x - min) / (max - min) : 0,
      );
    }
    const pops = candidateMovies.map((m) => m.popularity ?? 0);
    const ratings = candidateMovies.map((m) => m.rating ?? 0);
    const releaseDates = candidateMovies.map((m) =>
      m.release_date ? new Date(m.release_date).getTime() : 0,
    );
    const normPop = normalize(pops);
    const normRating = normalize(ratings);
    const normRelease = normalize(releaseDates);

    // Kết hợp điểm hybrid
    const combined = candidateMovies.map((m, i) => ({
      ...m,
      similarity: scores[i],
      score:
        (scores[i] || 0) * 0.5 +
        normPop[i] * 0.2 +
        normRating[i] * 0.2 +
        normRelease[i] * 0.1,
      reason:
        'Phim cùng thể loại, nội dung gần giống với phim bạn đã xem, ưu tiên phim mới và phổ biến',
    }));
    // Sắp xếp theo score kết hợp
    const recommendedMovies = _.orderBy(combined, ['score'], ['desc']).slice(
      0,
      topN,
    );

    // Chuyển về plain object và loại bỏ các trường circular, luôn lấy lại phim gốc từ allMovies hoặc fallback sang object m
    const safeMovies = recommendedMovies.map((m) => {
      const movieOrigin = allMovies.find((mov) => mov.id === m.id) || m;
      let plain: any = movieOrigin;
      if (movieOrigin && typeof movieOrigin.get === 'function') {
        plain = movieOrigin.get({ plain: true });
      }
      const data = plain?.dataValues || plain;
      return {
        id: data?.id,
        title: data?.title,
        description: data?.description,
        director: data?.director,
        cast: data?.cast,
        genres: Array.isArray(data?.genres)
          ? data.genres.map((g: any) =>
              g?.dataValues
                ? { id: g.dataValues.id, name: g.dataValues.name }
                : { id: g.id, name: g.name },
            )
          : [],
        poster_url: data?.poster_url,
        trailer_url: data?.trailer_url,
        release_date: data?.release_date,
        similarity: m.similarity,
        reason: m.reason,
        score: m.score,
      };
    });
    return safeMovies;
  }
}
