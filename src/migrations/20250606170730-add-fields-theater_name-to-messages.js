
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
   await queryInterface.addColumn('Messages', 'theater_name', {
     type: Sequelize.STRING,
     allowNull: true,
   });
   
  },

  down: async (queryInterface, Sequelize) => {
  await queryInterface.removeColumn('Messages', 'theater_name');
  },
};
