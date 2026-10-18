import { Controller, Get, Header, Req } from '@nestjs/common'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

// Serves the single-page admin (vanilla HTML/JS, no build step) at the root,
// and the form generator it loads (spec 011, AD-04).
@Controller()
export class AdminController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(): Promise<string> {
    return fs.readFile(path.join(__dirname, 'index.html'), 'utf8')
  }

  // The scripts of the generated form, by exact name: no path reaches the disk.
  @Get(['form.js', 'form-kit.js', 'form-media.js'])
  @Header('Content-Type', 'text/javascript; charset=utf-8')
  form(@Req() request: { path: string }): Promise<string> {
    return fs.readFile(path.join(__dirname, path.basename(request.path)), 'utf8')
  }
}
