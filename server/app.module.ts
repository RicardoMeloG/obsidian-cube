import { Module } from '@nestjs/common'
import { AdminController } from './admin/admin.controller'
import { ContentController } from './content/content.controller'
import { ContentService } from './content/content.service'

@Module({
  controllers: [AdminController, ContentController],
  providers: [ContentService],
})
export class AppModule {}
