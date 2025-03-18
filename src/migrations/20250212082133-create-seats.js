'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Seats', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      theater_room_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'TheaterRooms',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      seat_row: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      seat_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      seat_type: {
        type: Sequelize.ENUM('regular', 'vip', 'deluxe'),
        allowNull: false,
        defaultValue: 'regular',
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Seats');
  },
};
