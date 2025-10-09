# MCP Annotation Interface Template

```typescript
/**
 * Base interface for MCP annotations
 */
export interface MCPAnnotation {
    /** Unique identifier for the annotation */
    id: string;
    
    /** Type of annotation (e.g., 'context', 'metadata', 'reference') */
    type: AnnotationType;
    
    /** The actual content or data being annotated */
    content: any;
    
    /** Metadata about the annotation */
    metadata: AnnotationMetadata;
    
    /** Context information for MCP processing */
    context: AnnotationContext;
    
    /** Timestamp when annotation was created */
    createdAt: Date;
    
    /** Timestamp when annotation was last modified */
    modifiedAt: Date;
    
    /** Version of the annotation for conflict resolution */
    version: number;
}

/**
 * Metadata associated with an annotation
 */
export interface AnnotationMetadata {
    /** Tags for categorization and searching */
    tags: string[];
    
    /** Priority or importance level (1-10) */
    importance: number;
    
    /** Source system or application that created the annotation */
    source: string;
    
    /** Author or creator of the annotation */
    author?: string;
    
    /** Additional custom properties */
    properties?: Record<string, any>;
}

/**
 * Context information for MCP processing
 */
export interface AnnotationContext {
    /** Related annotation IDs */
    relationships: string[];
    
    /** Scope or domain of the annotation */
    scope: string;
    
    /** Access permissions and visibility */
    permissions: AnnotationPermissions;
    
    /** Processing hints for MCP consumers */
    processingHints?: ProcessingHints;
}

/**
 * Types of annotations supported
 */
export enum AnnotationType {
    CONTEXT = 'context',
    METADATA = 'metadata',
    REFERENCE = 'reference',
    INSTRUCTION = 'instruction',
    CONSTRAINT = 'constraint',
    EXAMPLE = 'example'
}

/**
 * Permission settings for annotation access
 */
export interface AnnotationPermissions {
    /** Who can read the annotation */
    read: PermissionLevel;
    
    /** Who can modify the annotation */
    write: PermissionLevel;
    
    /** Who can delete the annotation */
    delete: PermissionLevel;
}

/**
 * Permission levels for annotation access
 */
export enum PermissionLevel {
    PUBLIC = 'public',
    AUTHENTICATED = 'authenticated',
    OWNER = 'owner',
    PRIVATE = 'private'
}

/**
 * Processing hints for MCP consumers
 */
export interface ProcessingHints {
    /** Cache duration in milliseconds */
    cacheDuration?: number;
    
    /** Whether the annotation should be indexed */
    indexed?: boolean;
    
    /** Processing priority (1-10) */
    priority?: number;
    
    /** Custom processing instructions */
    instructions?: string[];
}
```

## Usage Example

```typescript
import { MCPAnnotation, AnnotationType, PermissionLevel } from './mcp-annotation';

const annotation: MCPAnnotation = {
    id: 'ann_123456',
    type: AnnotationType.CONTEXT,
    content: {
        description: 'User preference for dark theme',
        value: true
    },
    metadata: {
        tags: ['ui', 'preference', 'theme'],
        importance: 7,
        source: 'user-preferences-service',
        author: 'user@example.com'
    },
    context: {
        relationships: ['ann_theme_config', 'ann_ui_state'],
        scope: 'user-interface',
        permissions: {
            read: PermissionLevel.AUTHENTICATED,
            write: PermissionLevel.OWNER,
            delete: PermissionLevel.OWNER
        },
        processingHints: {
            cacheDuration: 3600000, // 1 hour
            indexed: true,
            priority: 5
        }
    },
    createdAt: new Date(),
    modifiedAt: new Date(),
    version: 1
};
```