'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('UserPreferences', 'similar_users', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Danh sách user tương tự và điểm tương đồng',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserPreferences', 'similar_users');
  },
};
