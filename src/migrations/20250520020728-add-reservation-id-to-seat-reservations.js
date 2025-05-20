'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('SeatReservations', 'reservation_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Thêm index cho reservation_id để tăng tốc tìm kiếm
    await queryInterface.addIndex('SeatReservations', ['reservation_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('SeatReservations', 'reservation_id');
  },
};
