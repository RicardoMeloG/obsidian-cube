import { BadRequestException, Body, Controller, Get, Header, NotFoundException, Param, Post, StreamableFile, UseGuards } from '@nestjs/common'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { AuthGuard } from '../auth/auth.guard'
import { MediaError, MediaStore } from './mediaStore'

// Same directory the site serves /content/media/ from (public/content, like
// the published documents). The server runs from the project root.
const store = new MediaStore(path.resolve(process.cwd(), 'public', 'content', 'media'))
const EXAMPLES_DIR = path.resolve(process.cwd(), 'public', 'examples')

// Upload and library of owner images (spec 011, AD-03), plus the files
// themselves so the admin can preview them. Every route needs a full session.
// The body of an upload is the raw WebP (main.ts registers that parser).
@UseGuards(AuthGuard)
@Controller()
export class MediaController {
  @Post('api/media')
  upload(@Body() body: unknown) {
    return this.run(() => store.storeImage(this.bytes(body)))
  }

  @Post('api/media/:hash/thumb')
  uploadThumb(@Param('hash') hash: string, @Body() body: unknown) {
    return this.run(() => store.storeThumb(hash, this.bytes(body)))
  }

  @Get('api/media')
  list() {
    return store.list()
  }

  @Get('content/media/:file')
  @Header('Content-Type', 'image/webp')
  async file(@Param('file') file: string) {
    return new StreamableFile(await this.run(() => store.read(file)))
  }

  // The committed example images, which the example content points at.
  @Get('examples/:file')
  @Header('Content-Type', 'image/webp')
  async example(@Param('file') file: string) {
    if (!/^[a-z0-9-]+\.webp$/.test(file)) throw new NotFoundException()
    return new StreamableFile(await fs.readFile(path.join(EXAMPLES_DIR, file)).catch(() => Promise.reject(new NotFoundException())))
  }

  private bytes(body: unknown): Uint8Array {
    if (!Buffer.isBuffer(body)) throw new BadRequestException('Envía la imagen como image/webp.')
    return body
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      if (error instanceof MediaError) throw new BadRequestException(error.message)
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException()
      throw error
    }
  }
}
