import { Module } from '@nestjs/common'
import { AdminController } from './admin/admin.controller'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { ContentController } from './content/content.controller'
import { ContentService } from './content/content.service'
import { DatabaseModule } from './database.module'
import { MediaController } from './media/media.controller'

@Module({
  imports: [DatabaseModule],
  controllers: [AdminController, AuthController, ContentController, MediaController],
  providers: [AuthService, ContentService],
})
export class AppModule {}
