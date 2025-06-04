'use strict';

/**
 * Migration: Thêm giá trị 'used' vào ENUM status của bảng Tickets
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Chỉ hỗ trợ PostgreSQL
    await queryInterface.sequelize.query(
      `ALTER TYPE \"enum_Tickets_status\" ADD VALUE IF NOT EXISTS 'used';`,
    );
  },

  async down(queryInterface, Sequelize) {
    // Không thể xóa giá trị ENUM trong PostgreSQL một cách an toàn, nên chỉ log cảnh báo
    // Nếu cần rollback, phải tạo lại ENUM và bảng Tickets
    console.warn(
      'Không thể xóa giá trị ENUM trong PostgreSQL. Nếu cần rollback, hãy tự xử lý thủ công.',
    );
  },
};
