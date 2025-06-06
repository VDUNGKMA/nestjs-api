'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Messages', 'movie_title', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Messages', 'movie_poster', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Messages', 'screening_time', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Messages', 'room_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Messages', 'movie_title');
    await queryInterface.removeColumn('Messages', 'movie_poster');
    await queryInterface.removeColumn('Messages', 'screening_time');
    await queryInterface.removeColumn('Messages', 'room_name');
  },
};
