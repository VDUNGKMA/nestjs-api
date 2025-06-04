'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SeatReservations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      screening_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Screenings',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      seat_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Seats',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      reservation_type: {
        type: Sequelize.ENUM('temporary', 'processing_payment'),
        allowNull: false,
        defaultValue: 'temporary',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Thêm chỉ mục để tìm kiếm đặt chỗ hết hạn nhanh hơn
    await queryInterface.addIndex('SeatReservations', ['expires_at']);

    // Thêm ràng buộc unique để tránh đặt chỗ trùng
    await queryInterface.addIndex(
      'SeatReservations',
      ['screening_id', 'seat_id'],
      {
        unique: true,
        name: 'unique_seat_reservation',
      },
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('SeatReservations');
  },
};
