'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Messages', 'reply_to_message_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Messages', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Messages', 'reply_to_message_id');
  },
};
