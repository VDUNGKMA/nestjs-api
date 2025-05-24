'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('TicketSeats', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Tickets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      seat_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Seats',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: true,
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

    // Thêm chỉ mục cho ticket_id và seat_id
    await queryInterface.addIndex('TicketSeats', ['ticket_id']);
    await queryInterface.addIndex('TicketSeats', ['seat_id']);

    // Thêm ràng buộc duy nhất cho ticket_id và seat_id
    await queryInterface.addConstraint('TicketSeats', {
      fields: ['ticket_id', 'seat_id'],
      type: 'unique',
      name: 'unique_ticket_seat',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('TicketSeats');
  },
};
