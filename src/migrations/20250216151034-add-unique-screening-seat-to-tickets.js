'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint('Tickets', {
      fields: ['screening_id', 'seat_id'],
      type: 'unique',
      name: 'unique_screening_seat', // Tên constraint, có thể thay đổi nếu muốn
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Tickets', 'unique_screening_seat');
  },
};
