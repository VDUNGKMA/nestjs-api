'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Thêm cột director
    await queryInterface.addColumn('Movies', 'director', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Thêm cột cast
    await queryInterface.addColumn('Movies', 'cast', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Xóa cột cast
    await queryInterface.removeColumn('Movies', 'cast');

    // Xóa cột director
    await queryInterface.removeColumn('Movies', 'director');
  },
};
