'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Đổi tên các cột về snake_case
    await queryInterface.renameColumn('Messages', 'imageUrl', 'image_url');
    await queryInterface.renameColumn('Messages', 'fileUrl', 'file_url');
    await queryInterface.renameColumn('Messages', 'fileName', 'file_name');
  },

  async down(queryInterface, Sequelize) {
    // Đổi lại về camelCase nếu rollback
    await queryInterface.renameColumn('Messages', 'image_url', 'imageUrl');
    await queryInterface.renameColumn('Messages', 'file_url', 'fileUrl');
    await queryInterface.renameColumn('Messages', 'file_name', 'fileName');
  },
};
