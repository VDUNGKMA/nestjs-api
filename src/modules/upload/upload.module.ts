import { Module, forwardRef } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../guards/roles.guard';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UploadController],
  providers: [JwtAuthGuard, RolesGuard],
})
export class UploadModule {}
