.md Test Assignment: Jira Project Assistant
Description
Create an assistant application for managing a project in Jira: it displays problematic issues and can automatically fix some of them.
Technical Requirements

TypeScript
React (functional components)
Material-UI (MUI)
Atlassian Forge
Docker (mandatory — Dockerfile + docker-compose)
Jira V3 API
Atlassian Forge (mandatory)
Any state manager of your choice

Functionality
1. Main Page — Issue List
A table with all the project's issues:

Columns: Key, Summary, Status, Assignee, Priority, Actions
Highlighting of problematic issues:

🔴 Issues without an assignee
🟡 Issues with low priority but an approaching deadline


In the Actions column, for problematic issues — a "Fix" button

2. Automatic Fixes
A "Fix" button for different problems:

Issue without an assignee → shows a modal with a list of project members to choose from
Low priority + approaching deadline → proposes raising the priority to Medium/High
After the action — updates the issue via the API and reloads the list

3. Control Panel (at the top)

Overall project statistics
"Auto-assign unassigned" button — bulk-assigns issues without an assignee to random active members
Project selection dropdown

4. Member Management
A separate "Team" tab:

List of project members
Shows how many issues are assigned to each one
Shows member activity (exactly how to calculate activity is not so important)

Code Requirements

Typing of all API requests and responses
Handling of loading/error states for each action
Optimistic UI updates (show changes immediately)
Confirmation dialogs for bulk actions
Usage documentation

Everything must be implemented using the Atlassian Forge development platform.