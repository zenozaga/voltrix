# Tasks Instructions for AI Agents

## Purpose
This folder contains executable tasks for AI agents working on the mcp-annotations project. Each task file (except this README.md) represents a specific operation that can be performed by an agent.

## Task Execution Format
To execute a task, use the following format:
```
run task:<number>
```

Where `<number>` corresponds to the task file number in the list below.

## Available Tasks

### Task 1: get_started.md
- **Purpose:** Initial onboarding and project analysis
- **When to use:** First time working with this project
- **Expected outcome:** Complete understanding of project structure and context

### Task 2: project_review.md  
- **Purpose:** Comprehensive project review and status assessment
- **When to use:** When you need to understand current project state
- **Expected outcome:** Detailed project analysis report

### Task 3: setup_development.md
- **Purpose:** Development environment setup and configuration
- **When to use:** When setting up local development environment
- **Expected outcome:** Fully configured development environment

### Task 4: analyze_codebase.md
- **Purpose:** Deep analysis of the existing codebase
- **When to use:** When you need to understand code architecture and patterns
- **Expected outcome:** Code analysis report with insights and recommendations

### Task 5: generate_documentation.md
- **Purpose:** Generate or update project documentation
- **When to use:** When documentation needs to be created or updated
- **Expected outcome:** Up-to-date documentation files

## Task Guidelines

### For AI Agents:
1. Always read the `.aicontext.yaml` file first to understand project context
2. Execute tasks in logical order (start with get_started.md)
3. Follow the coding standards defined in `rules.md`
4. Update task status and results in appropriate knowledge files
5. Ask for clarification if task requirements are unclear

### Task Development:
- Each task should be self-contained and executable
- Include clear success criteria for each task
- Provide examples and expected outputs
- Reference relevant knowledge base articles when needed

## Important Notes

- **This README.md file is NOT an executable task**
- Task files should be written in markdown format
- Tasks may reference files in other .ai-context folders (knowledge, templates, etc.)
- Always validate task completion against project requirements