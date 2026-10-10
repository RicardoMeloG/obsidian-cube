import { Controller, Get, Header } from '@nestjs/common'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

// Serves the single-page admin (vanilla HTML/JS, no build step) at the root.
@Controller()
export class AdminController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(): Promise<string> {
    return fs.readFile(path.join(__dirname, 'index.html'), 'utf8')
  }
}
