'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('UserPreferences', {
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      favorite_genres: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      favorite_directors: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      favorite_actors: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      preferred_screening_times: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      preferred_theaters: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      preferred_seat_types: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      preferred_seat_rows: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      watch_history: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      search_history: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      explicit_ratings: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      implicit_ratings: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      demographic_data: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      last_updated: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('UserPreferences');
  },
};
