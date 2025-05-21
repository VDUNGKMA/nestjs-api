'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Trước tiên cần xóa cột hiện tại vì Sequelize không hỗ trợ thay đổi giá trị ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE "Payments" 
      ALTER COLUMN payment_method TYPE VARCHAR(255)
    `);

    // Xóa type ENUM cũ
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_Payments_payment_method";
    `);

    // Tạo lại ENUM với giá trị mới
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_Payments_payment_method" AS ENUM('Momo', 'Visa', 'Cash', 'PayPal');
    `);

    // Đổi kiểu dữ liệu của cột về ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE "Payments"
      ALTER COLUMN payment_method TYPE "enum_Payments_payment_method" USING payment_method::text::"enum_Payments_payment_method"
    `);
  },

  async down (queryInterface, Sequelize) {
    // Hoàn tác lại thành ENUM cũ
    await queryInterface.sequelize.query(`
      ALTER TABLE "Payments" 
      ALTER COLUMN payment_method TYPE VARCHAR(255)
    `);

    // Xóa type ENUM mới
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_Payments_payment_method";
    `);

    // Tạo lại ENUM cũ
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_Payments_payment_method" AS ENUM('Momo', 'Visa', 'Cash');
    `);

    // Đổi kiểu dữ liệu của cột về ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE "Payments"
      ALTER COLUMN payment_method TYPE "enum_Payments_payment_method" USING payment_method::text::"enum_Payments_payment_method"
    `);
  }
};
