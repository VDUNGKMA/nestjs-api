import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_KEY } from 'src/decorators/role.decorator';
import { JwtAuthGuard } from '../modules/auth/passport/jwt-auth.guard'; // Import JwtAuthGuard

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(JwtAuthGuard) private readonly jwtAuthGuard: JwtAuthGuard, // Inject JwtAuthGuard
  ) {}  

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Giả sử thông tin người dùng đã được xác thực và gắn vào request

    if (!user || !user.role) {
      throw new UnauthorizedException('User information not available');
    }
     if (!requiredRoles.includes(user.role)) {
       throw new ForbiddenException(
         'Bạn không có quyền thực hiện thao tác này.',
       ); 
     }

    return requiredRoles.includes(user.role); // Kiểm tra xem vai trò của người dùng có trong danh sách yêu cầu không
  }
}
