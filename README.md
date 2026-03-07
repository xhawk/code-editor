# Code Editor AI

An Electron-based desktop application that integrates with Ollama AI models to provide an intelligent coding assistant with file management capabilities.

## Features

- AI-powered chat interface with Ollama integration
- Direct file operations (create, read, delete, list files)
- Git worktree support for isolated development environments
- Automatic code generation and file creation
- Multi-model selection for different AI tasks
- Real-time conversation history

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Ollama](https://ollama.ai/) installed and running locally
- Git (for version control features)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd code-editor-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Building

To build the application for production:

```bash
npm run build
```

This will create distributable packages for your platform.

## Usage

Once the application is running:

1. Select an Ollama model from the dropdown
2. Type your coding questions or requests in the chat input
3. The AI can help you by:
   - Answering coding questions
   - Generating code snippets
   - Creating files directly in your workspace
   - Reading and modifying existing files

### Available Commands

The AI assistant can perform these file operations:

- `create_file(relativePath, content)` - Create a new file with content
- `read_file(relativePath)` - Read the contents of a file
- `delete_file(relativePath)` - Delete a file
- `list_files(relativePath)` - List files in a directory

## Architecture

The application consists of:

- **Frontend**: React with TypeScript and Tailwind CSS
- **Backend**: Electron main process handling AI communication and file operations
- **AI Integration**: Ollama API for local AI model inference
- **File System**: Direct file manipulation capabilities

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.