import { Module } from '@nestjs/common';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';

@Module({
  imports: [
    NestElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200', // Đổi lại nếu bạn dùng cloud hoặc port khác
    }),
  ],
  exports: [NestElasticsearchModule],
})
export class ElasticsearchModule {}
