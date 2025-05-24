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

    // Nếu trường seat_id tồn tại, tiến hành xóa
    console.log('Trường seat_id tồn tại, tiến hành xóa khỏi bảng Tickets');
    await queryInterface.removeColumn('Tickets', 'seat_id');
  },

  down: async (queryInterface, Sequelize) => {
    // Kiểm tra xem trường seat_id có tồn tại không
    const tableInfo = await queryInterface.describeTable('Tickets');

    // Nếu trường seat_id đã tồn tại, không cần thêm lại
    if (tableInfo.seat_id) {
      console.log(
        'Trường seat_id đã tồn tại trong bảng Tickets, bỏ qua rollback',
      );
      return;
    }

    // Thêm lại trường seat_id nếu nó không tồn tại
    await queryInterface.addColumn('Tickets', 'seat_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Seats',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
};
