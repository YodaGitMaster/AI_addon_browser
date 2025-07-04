# Technical Decisions & Rationale

## Architecture Decisions

### Standalone Window vs Enhanced Popup
**Decision**: Use standalone draggable window instead of enhanced popup
**Rationale**: 
- User requirement for persistent window that doesn't close when clicking outside
- Need for draggable and resizable interface for better user control
- Header visibility issues in popup format
- Desktop application-like experience preferred over browser popup
- Native window controls (drag, resize, minimize, maximize) provide better UX
- More professional feel for extended AI conversations
- Single window instance with focus management prevents clutter

### Enhanced Popup vs Sidebar Interface
**Decision**: Use enhanced popup (500x700px) instead of sidebar interface
**Rationale**: 
- Firefox Manifest V3 doesn't support sidebar_action the same way as Chrome
- Cross-browser compatibility is essential for extension adoption
- Enhanced popup provides adequate space for chat functionality
- Reliable action button behavior across all browsers
- Maintains all chat features while ensuring the icon is clickable
- Standard popup approach has proven compatibility and support
**UPDATE**: Evolved to standalone window for superior user experience

### Sidebar Chat Interface vs Popup
**Decision**: Switch from popup to sidebar with full chat functionality
**Rationale**: 
- Persistent interface that doesn't close when user clicks outside
- More space for longer conversations and better UX
- Continuous context throughout browsing session
- Better suited for conversational AI interactions
- Allows for copy functionality and message history
- More natural for multi-turn conversations about page content
**UPDATE**: Reverted to enhanced popup due to Firefox compatibility issues

### Content Script + Sidebar Script Pattern
**Decision**: Use content script for page extraction, sidebar script for chat and API calls
**Rationale**: 
- Content scripts can access DOM but have CORS restrictions
- Sidebar scripts can make external API calls with proper CORS configuration
- Clean separation of concerns between content extraction and chat
- Compatible with Firefox sidebar architecture
- Maintains page context throughout conversation

### Conversational AI vs One-time Summarization
**Decision**: Implement full chat functionality instead of simple summarization
**Rationale**:
- Users can ask follow-up questions about page content
- More engaging and useful user experience
- Allows for clarification and deeper understanding
- Context-aware responses based on conversation history
- Better utilizes the capabilities of local AI models

### Copy Functionality Integration
**Decision**: Add copy buttons to all AI and user messages
**Rationale**:
- Users frequently need to copy AI responses for other uses
- Hover-based copy buttons maintain clean UI
- Essential for productivity and sharing content
- Simple implementation with modern clipboard API

### Context-Aware Prompts
**Decision**: Include page content and conversation history in every AI prompt
**Rationale**:
- Maintains conversation context across multiple exchanges
- AI responses are more relevant to current page content
- Enables follow-up questions and deeper analysis
- Creates more natural conversational flow

### Local Ollama Instance
**Decision**: Target localhost:11434 (default Ollama port)
**Rationale**:
- Privacy - no data sent to external services
- Speed - local processing
- Cost - no API fees
- User control over model selection
- Works with CORS configuration

### Text Extraction Strategy
**Decision**: Extract textContent from main content areas, skip nav/footer
**Rationale**:
- Focuses on article content
- Reduces noise in summary
- Handles various page layouts
- Maintains efficiency for AI processing

### CORS Header Handling
**Decision**: Remove explicit Origin header from API calls, configure Ollama server
**Rationale**:
- Explicit extension origin (moz-extension://) rejected by Ollama CORS policy
- Server-side configuration (OLLAMA_ORIGINS='*') is the proper solution
- Maintains security while enabling functionality
- Works with both popup and sidebar architectures

### Message Storage and History
**Decision**: Store chat sessions in browser.storage.local
**Rationale**:
- Preserves conversation history across sessions
- Enables future features like session management
- Local storage maintains privacy
- Provides debugging and analytics capabilities

## Technology Stack
- Manifest V3 (Firefox addon standard)
- Vanilla JavaScript (no frameworks - keep lightweight)
- CSS Grid/Flexbox for sidebar layout
- Fetch API for Ollama communication
- Modern CSS features for chat interface

### Firefox-Specific Requirements
- Uses "sidebar_action" instead of "action" for sidebar interface
- Manifest V3 but with Firefox-specific sidebar configuration
- Browser APIs (browser.* instead of chrome.*)

## Abandoned Approaches
- **Popup Interface**: Limited space and closes when user clicks outside
- **One-time Summarization**: Less engaging than conversational interface
- **Background Script**: Added unnecessary complexity without benefits
- **Service Worker**: Firefox compatibility issues
- **External API**: Privacy and cost concerns

## Configuration Choices
- Default Ollama model: gemma3:latest
- Max content length: 3000 chars in context (prevent huge requests)
- Sidebar chat interface with persistent context
- Auto-scroll and typing indicators for better UX
- Copy functionality for all messages
- Context window: Last 3 conversation exchanges + full page content 