'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Tạo rạp phim
    await queryInterface.bulkInsert('Theaters', [
      {
        name: 'Cinema Demo',
        location: '123 Demo Street, Demo City',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Lấy ID của rạp vừa tạo
    const [theaters] = await queryInterface.sequelize.query(
      `SELECT id FROM "Theaters" WHERE name = 'Cinema Demo'`,
    );
    const theaterId = theaters[0].id;

    // 2. Tạo phòng chiếu
    await queryInterface.bulkInsert('TheaterRooms', [
      {
        theater_id: theaterId,
        room_name: 'Room 1',
        seat_capacity: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Lấy ID của phòng chiếu
    const [rooms] = await queryInterface.sequelize.query(
      `SELECT id FROM "TheaterRooms" WHERE room_name = 'Room 1' AND theater_id = ${theaterId}`,
    );
    const roomId = rooms[0].id;

    // 3. Tạo phim
    await queryInterface.bulkInsert('Movies', [
      {
        title: 'Demo Movie',
        description: 'A movie for testing seat reservations',
        duration: 120,
        release_date: new Date(),
        poster_url: 'https://example.com/poster.jpg',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Lấy ID của phim
    const [movies] = await queryInterface.sequelize.query(
      `SELECT id FROM "Movies" WHERE title = 'Demo Movie'`,
    );
    const movieId = movies[0].id;

    // 4. Tạo buổi chiếu
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2); // Thêm 2 giờ cho thời lượng phim

    await queryInterface.bulkInsert('Screenings', [
      {
        movie_id: movieId,
        theater_room_id: roomId,
        start_time: startTime,
        end_time: endTime,
        price: 10.99,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Lấy ID của buổi chiếu
    const [screenings] = await queryInterface.sequelize.query(
      `SELECT id FROM "Screenings" WHERE movie_id = ${movieId} AND theater_room_id = ${roomId}`,
    );
    const screeningId = screenings[0].id;

    // 5. Tạo ghế ngồi
    const seats = [];
    const rows = ['A', 'B', 'C', 'D', 'E'];
    const seatsPerRow = 10;

    for (const row of rows) {
      for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
        seats.push({
          theater_room_id: roomId,
          seat_row: row,
          seat_number: seatNum,
          seat_type: 'regular',
          price: 10.0,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    await queryInterface.bulkInsert('Seats', seats);

    console.log('Đã thêm dữ liệu demo thành công!');
  },

  async down(queryInterface, Sequelize) {
    // Xóa dữ liệu theo thứ tự ngược lại
    await queryInterface.bulkDelete('Seats', null, {});
    await queryInterface.bulkDelete('Screenings', null, {});
    await queryInterface.bulkDelete('Movies', null, {});
    await queryInterface.bulkDelete('TheaterRooms', null, {});
    await queryInterface.bulkDelete('Theaters', null, {});
  },
};
