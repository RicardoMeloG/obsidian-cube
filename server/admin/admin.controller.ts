import { Controller, Get, Header } from '@nestjs/common'
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

  @Get('form.js')
  @Header('Content-Type', 'text/javascript; charset=utf-8')
  form(): Promise<string> {
    return fs.readFile(path.join(__dirname, 'form.js'), 'utf8')
  }
}
