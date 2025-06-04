'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Payments', 'payment_method', {
      type: Sequelize.ENUM('Momo', 'Visa', 'Cash'),
      allowNull: true, // Cho phép null, phù hợp với PaymentAttributes
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Payments', 'payment_method');
  },
};
