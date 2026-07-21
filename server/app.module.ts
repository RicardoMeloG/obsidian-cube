import { Module } from '@nestjs/common'
import { AdminController } from './admin/admin.controller'
import { ContentController } from './content/content.controller'
import { ContentService } from './content/content.service'
import { DatabaseModule } from './database.module'

@Module({
  imports: [DatabaseModule],
  controllers: [AdminController, ContentController],
  providers: [ContentService],
})
export class AppModule {}
