import { Body, Controller, Get, NotFoundException, Param, Post, Put } from '@nestjs/common'
import { ContentService } from './content.service'
import { isDocId } from './docs'
import type { DocId } from './docs'

@Controller('api')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('docs')
  docs() {
    return this.content.listDocs()
  }

  @Get('content/:doc')
  read(@Param('doc') doc: string) {
    return this.content.read(this.assertDoc(doc))
  }

  @Post('content/:doc/validate')
  validate(@Param('doc') doc: string, @Body() body: unknown) {
    return this.content.validate(this.assertDoc(doc), body)
  }

  @Put('content/:doc/draft')
  saveDraft(@Param('doc') doc: string, @Body() body: unknown) {
    return this.content.saveDraft(this.assertDoc(doc), body)
  }

  @Post('content/:doc/publish')
  publish(@Param('doc') doc: string, @Body() body: unknown) {
    return this.content.publish(this.assertDoc(doc), body)
  }

  @Get('content/:doc/versions')
  versions(@Param('doc') doc: string) {
    return this.content.listVersions(this.assertDoc(doc))
  }

  @Post('content/:doc/restore/:versionId')
  restore(@Param('doc') doc: string, @Param('versionId') versionId: string) {
    if (!/^\d+$/.test(versionId)) {
      throw new NotFoundException(`Invalid version id: ${versionId}`)
    }
    return this.content.restore(this.assertDoc(doc), versionId)
  }

  // Whitelist guard: only the three known document ids ever reach the service /
  // filesystem / SQL, so ":doc" can never be used for path traversal.
  private assertDoc(doc: string): DocId {
    if (!isDocId(doc)) {
      throw new NotFoundException(`Unknown document: ${doc}`)
    }
    return doc
  }
}
