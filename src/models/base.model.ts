// src/models/base.model.ts
import { Model } from 'sequelize-typescript';

export class BaseModel<T extends {}> extends Model<T> {
  toJSON() {
    const values = super.toJSON();
    const adjustToUTC7 = (date: Date) => {
      const vietnamDate = new Date(date.getTime() + 7 * 60 * 60 * 1000); // Cộng 7 giờ để chuyển sang UTC+7
      return vietnamDate.toISOString().replace('Z', '+07:00'); // Định dạng ISO 8601 với +07:00
    };

    // Tự động chuyển đổi tất cả các trường kiểu Date
    Object.keys(values).forEach((key) => {
      if (values[key] instanceof Date) {
        values[key] = adjustToUTC7(values[key]);
      }
    });

    return values;
  }
}
