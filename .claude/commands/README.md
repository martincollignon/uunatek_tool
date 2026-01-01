# Claude Commands for Zagreb Plotter

This directory contains custom slash commands for Claude Code to streamline development workflows.

## Available Commands

### `/build [option]`
Build the Tauri production app with proper environment setup.

**Usage:**
- `/build` or `/build prod` - Create production bundle (DMG + .app)
- `/build dev` - Run in development mode with hot-reload
- `/build clean` - Clean build artifacts before building

**What it does:**
- Sets up Rust/Cargo environment automatically
- Compiles TypeScript and builds Vite frontend
- Compiles Rust backend
- Creates distributable macOS bundles

**Output location:**
- App: `frontend/src-tauri/target/release/bundle/macos/Zagreb Plotter.app`
- DMG: `frontend/src-tauri/target/release/bundle/dmg/Zagreb Plotter_1.0.0_aarch64.dmg`

## Adding More Commands

To add a new command:

1. Create a new `.md` file in this directory: `.claude/commands/your-command.md`
2. Optionally add frontmatter with metadata:
   ```markdown
   ---
   description: Brief description of what the command does
   argument-hint: "[optional|arguments]"
   model: sonnet  # optional: specify Claude model
   ---

   Your command prompt goes here...
   ```

3. Use the command with `/your-command` in Claude Code

## Resources

- [Claude Code Slash Commands Docs](https://code.claude.com/docs/en/slash-commands)
- [Custom Commands Tutorial](https://cloudartisan.com/posts/2025-04-14-claude-code-tips-slash-commands/)
