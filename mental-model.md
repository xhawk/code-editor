# Mental Model: How the Application Works

## Overview

This application is an Electron-based AI coding assistant that combines local AI models (via Ollama) with Git version control. It allows users to chat with an AI assistant that can directly manipulate files in the filesystem and integrate with Git workflows.

## Core Components

### 1. Frontend (React)
- **UI Components**: 
  - Chat interface (Header, ChatArea, Message, Input)
  - Git sidebar for status tracking
  - Worktree management interface

- **State Management**:
  - Tracks selected AI model
  - Manages chat messages
  - Handles loading states and errors
  - Maintains Git repository information

### 2. Backend (Electron Main Process)

#### A. Ollama Integration
- Communicates with local Ollama API at `http://127.0.0.1:11434`
- Supports streaming responses for real-time chat experience
- Implements tool calling functionality for file operations

#### B. File System Tools
Five core tools available to the AI:
1. `create_file` - Create new files with content
2. `read_file` - Read existing file contents
3. `delete_file` - Delete files
4. `list_files` - List directory contents
5. `get_git_status` - Get current Git repository status

#### C. Git Integration
- Automatic worktree creation for safe experimentation
- Status tracking for modified/staged/untracked files
- Commit functionality integrated into chat
- Multi-worktree support

### 3. Communication Layer
- Uses Electron's IPC (Inter-Process Communication) system
- Frontend sends requests via `window.electron` methods
- Backend responds through IPC handlers
- Real-time streaming via event callbacks

## Data Flow Architecture

```
User Input → React Component → IPC Call → Electron Handler → Ollama API
                                                                    ↓
File Operations ← Tool Execution ← Ollama Response ← Streaming ← Generator Function
       ↓               ↓                 ↓              ↓            ↑
   File System    Git Commands     Response Chunks   Event Stream    │
       ↓               ↓                 ↓              ↓            │
   Git Tracking   Status Update    UI Update     Continue Stream ────┘
```

## Key Features Explained

### AI-Powered File Manipulation
When the user chats with the AI:
1. Messages are sent to Ollama with available tools context
2. AI can decide to use tools for file operations
3. Tool execution happens in the Electron backend
4. Results are automatically added to Git staging
5. Responses are streamed back to the UI in real-time

### Git Worktree Sandbox
- Automatically creates isolated Git worktrees for experiments
- All AI file operations happen in a safe environment
- Users can commit changes or discard the entire worktree
- Prevents accidental modifications to the main codebase

### Smart Code Block Processing
- Automatically detects code blocks in AI responses
- Creates actual files from properly formatted responses
- Provides visual feedback about created files
- Integrates seamlessly with Git workflow

## Component Interactions

### Chat Interaction Flow
1. User types message in Input component
2. Message is sent via IPC to Electron backend
3. Electron forwards to Ollama API with tool definitions
4. Ollama processes request and may call tools
5. Tools execute file operations in the background
6. Results are streamed back to frontend via events
7. ChatArea updates with incremental responses
8. Created files are automatically Git-tracked

### Git Workflow Integration
1. App checks for Git repository on startup
2. Automatically creates worktree for AI experiments
3. All file operations are automatically staged
4. Special "commit" command triggers Git commits
5. Status sidebar shows real-time file changes
6. Worktree management allows archiving experiments

## Technical Implementation Details

### State Management
- Uses React state for UI concerns
- Electron state management for backend paths/settings
- Automatic synchronization between frontend/backend states

### Error Handling
- Comprehensive error catching in all IPC handlers
- Fallback mechanisms for unsupported features
- User-friendly error messages in UI

### Performance Considerations
- Streaming responses for better perceived performance
- Asynchronous operations to prevent UI blocking
- Efficient file system operations with proper error handling

## Security Model
- All operations are sandboxed within specified working directory
- No network access beyond localhost Ollama API
- File system access limited to project directory
- Git operations contained within repository boundaries