// src/migrations/xxxxxx-add-popularity-rating-to-movies.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Movies', 'popularity', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('Movies', 'rating', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Movies', 'popularity');
    await queryInterface.removeColumn('Movies', 'rating');
  },
};
