'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // Loại bỏ cột genre khỏi bảng Movies
    await queryInterface.removeColumn('Movies', 'genre');
  },
  async down(queryInterface, Sequelize) {
    // Khôi phục lại cột genre nếu rollback migration
    await queryInterface.addColumn('Movies', 'genre', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
