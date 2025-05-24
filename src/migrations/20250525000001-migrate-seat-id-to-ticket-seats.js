'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Kiểm tra xem trường seat_id có tồn tại trong bảng Tickets không
    const tableInfo = await queryInterface.describeTable('Tickets');

    // Nếu trường seat_id không tồn tại, không cần thực hiện migration
    if (!tableInfo.seat_id) {
      console.log(
        'Trường seat_id không tồn tại trong bảng Tickets, bỏ qua migration',
      );
      return;
    }

    // Nếu trường seat_id tồn tại, tiếp tục migration
    console.log(
      'Trường seat_id tồn tại, thực hiện di chuyển dữ liệu sang TicketSeats',
    );

    // Bước 1: Lấy tất cả tickets có seat_id không null
    const tickets = await queryInterface.sequelize.query(
      'SELECT id, seat_id FROM "Tickets" WHERE seat_id IS NOT NULL',
      { type: Sequelize.QueryTypes.SELECT },
    );

    // Bước 2: Chèn dữ liệu vào bảng TicketSeats
    for (const ticket of tickets) {
      // Kiểm tra xem đã có bản ghi trong TicketSeats chưa
      const existingTicketSeat = await queryInterface.sequelize.query(
        'SELECT * FROM "TicketSeats" WHERE ticket_id = :ticketId AND seat_id = :seatId',
        {
          replacements: { ticketId: ticket.id, seatId: ticket.seat_id },
          type: Sequelize.QueryTypes.SELECT,
        },
      );

      // Nếu chưa có, thêm mới
      if (existingTicketSeat.length === 0) {
        await queryInterface.sequelize.query(
          `INSERT INTO "TicketSeats" (ticket_id, seat_id, created_at, updated_at) 
           VALUES (:ticketId, :seatId, NOW(), NOW())`,
          {
            replacements: { ticketId: ticket.id, seatId: ticket.seat_id },
            type: Sequelize.QueryTypes.INSERT,
          },
        );
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Không thực hiện rollback cho migration này vì có thể gây mất dữ liệu
    console.log('Rollback for this migration is not supported.');
  },
};
