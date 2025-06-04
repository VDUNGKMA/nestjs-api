'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Genres', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // Nếu không cần timestamps, không thêm createdAt, updatedAt
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Genres');
  },
};
